"""
nlp_engine.py
--------------
Core NLP pipeline for TaskGenius AI.

Given a raw natural-language sentence such as:
    "Complete my cloud computing report next Monday at 10 AM. It's urgent. #college"

This module runs a pipeline:
    1. Temporal Parsing       -> due_date / due_time (ISO strings) + strips date tokens
                                  also detects recurrence ("every Monday", "daily", ...)
    2. Tag Extraction         -> #hashtag style tags, stripped from the text
    3. Priority Classification -> high / medium / low
    4. Category Classification -> study / work / personal / health / finance / general
    5. Title Extraction       -> a clean, crisp task title

Temporal parsing is done with hand-written regex + manual date arithmetic
rather than dateparser.search_dates, because that function proved unreliable
for common phrases like "next Monday" and "at 10 AM" during testing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, time as time_cls
from typing import List, Optional


# --------------------------------------------------------------------------- #
# 1. CONFIGURATION: keyword tables driving priority + category classification
# --------------------------------------------------------------------------- #

PRIORITY_KEYWORDS = {
    "high": [
        r"\burgent\b", r"\basap\b", r"\bcritical\b", r"\bimportant\b",
        r"\bemergency\b", r"!high\b",
    ],
    "medium": [
        r"\btomorrow\b", r"\bsoon\b", r"\bshortly\b", r"!medium\b",
    ],
    "low": [
        r"\blater\b", r"\bwhenever\b", r"\bsomeday\b", r"\bno rush\b", r"!low\b",
    ],
}

PRIORITY_META = {
    "high": {"label": "High", "emoji": "🔴", "color": "red"},
    "medium": {"label": "Medium", "emoji": "🟡", "color": "amber"},
    "low": {"label": "Low", "emoji": "🟢", "color": "green"},
}

CATEGORY_KEYWORDS = {
    "study": {
        "keywords": [
            "assignment", "report", "exam", "quiz", "homework", "study",
            "thesis", "lecture", "syllabus", "notes", "revision",
        ],
        "color": "purple",
    },
    "work": {
        "keywords": [
            "meeting", "project", "email", "presentation", "client",
            "deadline", "standup", "review", "invoice",
        ],
        "color": "blue",
    },
    "personal": {
        "keywords": [
            "call", "buy", "clean", "mom", "dad", "shopping", "grocery",
            "birthday", "family", "friend",
        ],
        "color": "amber",
    },
    "health": {
        "keywords": [
            "gym", "workout", "doctor", "medicine", "appointment",
            "yoga", "run", "diet", "checkup",
        ],
        "color": "green",
    },
    "finance": {
        "keywords": [
            "pay", "bill", "rent", "bank", "loan", "salary", "tax", "emi",
        ],
        "color": "emerald",
    },
}

CATEGORY_DEFAULT = {"name": "general", "label": "General", "color": "gray"}

_URGENCY_STRIP_PATTERN = re.compile(
    r"\b(urgent(ly)?|asap|critical(ly)?|important|emergency|soon|shortly|"
    r"later|whenever|someday|no rush)\b|!high\b|!medium\b|!low\b",
    flags=re.IGNORECASE,
)
_FILLER_PATTERN = re.compile(
    r"\b(it'?s|its|please|kindly|remember to|need to|have to|gotta)\b",
    flags=re.IGNORECASE,
)
_PUNCT_CLEANUP_PATTERN = re.compile(r"\s{2,}")
_STRAY_PUNCT_PATTERN = re.compile(r"[.,;:!]+")
_TRAILING_JUNK_PATTERN = re.compile(r"^[\s.,;:\-]+|[\s.,;:\-]+$")

# --------------------------------------------------------------------------- #
# TAGS: #hashtag style tags anywhere in the text
# --------------------------------------------------------------------------- #

_TAG_PATTERN = re.compile(r"#(\w+)")


def _extract_tags(text: str):
    tags = [m.lower() for m in _TAG_PATTERN.findall(text)]
    # de-dupe while preserving order
    seen = set()
    unique_tags = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            unique_tags.append(t)
    stripped_text = _TAG_PATTERN.sub("", text)
    return unique_tags, stripped_text


# --------------------------------------------------------------------------- #
# RECURRENCE: "every day", "daily", "every Monday", "weekly", "monthly"
# --------------------------------------------------------------------------- #

_RECURRENCE_PATTERN = re.compile(
    r"\b(every\s+day|everyday|daily|every\s+week|weekly|every\s+month|monthly)\b",
    re.IGNORECASE,
)


def _classify_recurrence(text: str) -> tuple[str, str]:
    """Returns (recurrence, remaining_text_with_match_stripped)."""
    match = _RECURRENCE_PATTERN.search(text)
    if not match:
        return "none", text

    phrase = match.group(1).lower()
    if "day" in phrase:
        recurrence = "daily"
    elif "week" in phrase:
        recurrence = "weekly"
    else:
        recurrence = "monthly"

    remaining = text[: match.start()] + " " + text[match.end():]
    return recurrence, remaining


@dataclass
class ParsedTask:
    title: str
    raw_text: str
    due_date: Optional[str]
    due_time: Optional[str]
    priority: str
    priority_label: str
    priority_emoji: str
    priority_color: str
    category: str
    category_label: str
    category_color: str
    tags: List[str] = field(default_factory=list)
    recurrence: str = "none"
    matched_temporal_text: Optional[str] = field(default=None)


# --------------------------------------------------------------------------- #
# STEP: Temporal parsing (custom regex + manual date arithmetic)
# --------------------------------------------------------------------------- #

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

# "every" is now accepted as a prefix too, e.g. "every Monday" -> weekly recurrence
_WEEKDAY_PATTERN = re.compile(
    r"\b(?:(next|this|on|every)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
    re.IGNORECASE,
)
_RELATIVE_DATE_PATTERN = re.compile(r"\b(today|tomorrow|tonight)\b", re.IGNORECASE)
_TIME_PATTERN = re.compile(
    r"\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(noon|midnight)\b",
    re.IGNORECASE,
)


def _resolve_weekday(prefix: Optional[str], weekday_name: str, base_date: datetime) -> str:
    target = _WEEKDAYS[weekday_name.lower()]
    current = base_date.weekday()
    prefix = (prefix or "").lower()

    if prefix == "this":
        days_ahead = (target - current) % 7
    else:
        # bare weekday, "next <day>", "on <day>", or "every <day>" -> the upcoming occurrence
        days_ahead = (target - current + 7) % 7
        days_ahead = days_ahead or 7

    return (base_date + timedelta(days=days_ahead)).date().isoformat()


def _resolve_time(hour_str, minute_str, meridiem, named) -> str:
    if named:
        return "12:00:00" if named.lower() == "noon" else "00:00:00"

    hour = int(hour_str)
    minute = int(minute_str) if minute_str else 0
    meridiem = (meridiem or "").lower()

    if meridiem == "pm" and hour != 12:
        hour += 12
    elif meridiem == "am" and hour == 12:
        hour = 0

    return time_cls(hour=hour, minute=minute).isoformat()


def _extract_temporal(text: str, base_date: Optional[datetime] = None):
    """Returns (due_date, due_time, remaining_text, matched_temporal, weekday_recurrence)."""
    base_date = base_date or datetime.now()
    working_text = text
    matched_fragments = []
    due_date = None
    due_time = None
    weekday_recurrence = None

    weekday_match = _WEEKDAY_PATTERN.search(working_text)
    if weekday_match:
        prefix = weekday_match.group(1)
        due_date = _resolve_weekday(prefix, weekday_match.group(2), base_date)
        if prefix and prefix.lower() == "every":
            weekday_recurrence = "weekly"
        matched_fragments.append(weekday_match.group(0))
        working_text = working_text[: weekday_match.start()] + " " + working_text[weekday_match.end():]
    else:
        relative_match = _RELATIVE_DATE_PATTERN.search(working_text)
        if relative_match:
            word = relative_match.group(1).lower()
            due_date = (
                (base_date + timedelta(days=1)).date().isoformat()
                if word == "tomorrow"
                else base_date.date().isoformat()
            )
            matched_fragments.append(relative_match.group(0))
            working_text = working_text[: relative_match.start()] + " " + working_text[relative_match.end():]

    time_match = _TIME_PATTERN.search(working_text)
    if time_match:
        due_time = _resolve_time(
            time_match.group(1), time_match.group(2), time_match.group(3), time_match.group(4)
        )
        matched_fragments.append(time_match.group(0))
        working_text = working_text[: time_match.start()] + " " + working_text[time_match.end():]

    matched_temporal = " ".join(matched_fragments) if matched_fragments else None
    return due_date, due_time, working_text, matched_temporal, weekday_recurrence


# --------------------------------------------------------------------------- #
# STEP: Priority classification
# --------------------------------------------------------------------------- #

def _classify_priority(text: str) -> str:
    lowered = text.lower()
    for level in ("high", "medium", "low"):
        for pattern in PRIORITY_KEYWORDS[level]:
            if re.search(pattern, lowered, flags=re.IGNORECASE):
                return level
    return "low"


# --------------------------------------------------------------------------- #
# STEP: Category classification
# --------------------------------------------------------------------------- #

def _classify_category(text: str):
    lowered = text.lower()
    for name, config in CATEGORY_KEYWORDS.items():
        for kw in config["keywords"]:
            if re.search(rf"\b{re.escape(kw)}\b", lowered):
                return {"name": name, "label": name.capitalize(), "color": config["color"]}
    return CATEGORY_DEFAULT


# --------------------------------------------------------------------------- #
# STEP: Title extraction / cleanup
# --------------------------------------------------------------------------- #

_DANGLING_PREP_PATTERN = re.compile(
    r"\b(by|on|at|in)\s*$", flags=re.IGNORECASE
)
_TIME_OF_DAY_PATTERN = re.compile(
    r"\b(morning|afternoon|evening|night|tonight)\b", flags=re.IGNORECASE
)

def _extract_title(text: str) -> str:
    cleaned = _URGENCY_STRIP_PATTERN.sub("", text)
    cleaned = _FILLER_PATTERN.sub("", cleaned)
    cleaned = _TIME_OF_DAY_PATTERN.sub("", cleaned)
    cleaned = _STRAY_PUNCT_PATTERN.sub("", cleaned)
    cleaned = _PUNCT_CLEANUP_PATTERN.sub(" ", cleaned)
    cleaned = cleaned.strip()
    cleaned = _DANGLING_PREP_PATTERN.sub("", cleaned).strip()
    cleaned = _TRAILING_JUNK_PATTERN.sub("", cleaned)

    if not cleaned:
        return text.strip()

    return cleaned[0].upper() + cleaned[1:] if len(cleaned) > 1 else cleaned.upper()

# --------------------------------------------------------------------------- #
# PUBLIC ENTRYPOINT
# --------------------------------------------------------------------------- #

def parse_task(raw_text: str, base_date: Optional[datetime] = None) -> ParsedTask:
    raw_text = raw_text.strip()

    tags, text_no_tags = _extract_tags(raw_text)
    explicit_recurrence, text_no_recurrence = _classify_recurrence(text_no_tags)

    due_date, due_time, text_after_dates, matched_temporal, weekday_recurrence = _extract_temporal(
        text_no_recurrence, base_date=base_date
    )
    recurrence = explicit_recurrence if explicit_recurrence != "none" else (weekday_recurrence or "none")

    priority = _classify_priority(raw_text)
    p_meta = PRIORITY_META[priority]
    category = _classify_category(raw_text)
    title = _extract_title(text_after_dates)

    return ParsedTask(
        title=title,
        raw_text=raw_text,
        due_date=due_date,
        due_time=due_time,
        priority=priority,
        priority_label=p_meta["label"],
        priority_emoji=p_meta["emoji"],
        priority_color=p_meta["color"],
        category=category["name"],
        category_label=category["label"],
        category_color=category["color"],
        tags=tags,
        recurrence=recurrence,
        matched_temporal_text=matched_temporal,
    )


if __name__ == "__main__":
    samples = [
        "Complete my cloud computing report next Monday at 10 AM. It's urgent. #college",
        "Buy groceries tomorrow evening #home",
        "Pay the electricity bill by Friday, critical #finance",
        "Go for a run whenever",
        "Water the plants every day",
        "Team standup every Monday at 9am #work",
    ]
    for s in samples:
        print(s, "->", parse_task(s))
