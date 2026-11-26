"""
Find which hotel features (aspects) a guest mentions, and where.

Matching is done on whole words of the normalized text. The earlier version
matched substrings, so "ac" (air conditioning) was found inside "place" and
"back", "bar" inside "barely" and "neat" inside "beneath".

Each aspect has two kinds of keywords:
- targets: nouns naming the feature ("room", "staff", "wifi", "breakfast")
- attributes: opinion words that only describe that feature ("dirty" is
  about cleanliness, "rude" is about staff, "noisy" is about noise)

The analyzer links each mention to the nearest opinion, and a clause that has
an opinion but no target ("clean but | small") borrows the targets of the
clause next to it.

The aspect names must stay in sync with client/src/i18n/*.json -> review.aspects.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Tuple

ASPECT_ORDER = ["cleanliness", "staff", "location", "room", "wifi", "value", "facilities", "food", "noise"]

ASPECT_TARGETS: Dict[str, List[str]] = {
    "cleanliness": [
        "cleanliness", "hygiene", "housekeeping", "dust", "dirt", "stain", "smell", "odor",
        "odour", "stench", "mold", "mould", "mildew", "cockroach", "roach", "bug", "bedbug",
        "insect", "hair", "garbage", "trash", "rubbish", "filth",
    ],
    "staff": [
        "staff", "host", "hostess", "receptionist", "reception", "front desk", "service",
        "manager", "management", "employee", "worker", "waiter", "waitress", "waitstaff",
        "concierge", "owner", "personnel", "team", "crew", "hospitality", "housekeeper",
        "porter", "bellboy", "attendant", "checkin", "checkout", "behaviour", "behavior",
        "room service", "customer service", "guard", "security guard", "caretaker",
    ],
    "location": [
        "location", "area", "neighborhood", "neighbourhood", "surroundings", "surrounding",
        "distance", "market", "bazaar", "center", "centre", "city center", "city centre",
        "downtown", "beach", "station", "metro", "subway", "bus stop", "airport",
        "attractions", "sights", "sightseeing", "landmark", "mall", "shops", "shopping",
        "walking distance", "close to", "old town", "lake", "river", "mountains",
    ],
    "room": [
        "room", "bedroom", "bed", "mattress", "pillow", "sheets", "linen", "blanket", "duvet",
        "bathroom", "washroom", "toilet", "shower", "bathtub", "tub", "sink", "towel", "suite",
        "window", "space", "furniture", "chair", "sofa", "couch", "desk", "table", "wardrobe",
        "closet", "cupboard", "carpet", "curtain", "decor", "interior", "balcony", "ceiling",
        "wall", "floor", "tv", "television", "lamp", "lighting", "mirror", "door",
    ],
    "wifi": ["wifi", "internet", "network", "connection", "connectivity", "signal", "broadband", "bandwidth", "router", "hotspot"],
    "value": [
        "price", "pricing", "cost", "money", "value", "rates", "room rate", "tariff", "fee",
        "charges", "surcharge", "bill", "budget", "bargain", "value for money", "rupee",
    ],
    "facilities": [
        "facility", "facilities", "amenity", "amenities", "ac", "air conditioning",
        "air conditioner", "aircon", "heater", "heating", "fan", "parking", "garage", "pool",
        "swimming pool", "gym", "fitness", "spa", "sauna", "jacuzzi", "kitchen", "kitchenette",
        "lift", "elevator", "laundry", "generator", "ups", "electricity", "power", "geyser",
        "hot water", "garden", "terrace", "rooftop", "lobby", "playground", "kettle", "fridge",
        "refrigerator", "minibar", "mini bar", "microwave", "iron", "hairdryer", "shuttle",
        "lounge", "fitness center", "fitness centre", "business center", "business centre",
    ],
    "food": [
        "breakfast", "lunch", "dinner", "brunch", "restaurant", "food", "meal", "buffet", "bar",
        "coffee", "tea", "menu", "cuisine", "dish", "chef", "cook", "snack", "drink", "beverage",
        "juice", "egg", "bread", "dessert",
    ],
    "noise": ["noise", "sound", "soundproofing", "soundproof", "insulation", "thin walls", "music"],
}

ASPECT_ATTRIBUTES: Dict[str, List[str]] = {
    "cleanliness": [
        "clean", "cleaned", "cleaning", "unclean", "dirty", "filthy", "spotless", "immaculate",
        "pristine", "hygienic", "unhygienic", "unsanitary", "sanitary", "neat", "tidy",
        "untidy", "messy", "grimy", "grubby", "dusty", "smelly", "stinky", "musty", "moldy",
        "mouldy", "stained", "sparkling", "smelled", "smells", "smelt", "stank", "stink",
        "stinks", "cleanest", "dirtiest", "dingy",
    ],
    "staff": [
        "helpful", "unhelpful", "rude", "rudest", "friendly", "unfriendly", "polite",
        "impolite", "courteous", "welcoming", "unwelcoming", "attentive", "inattentive",
        "professional", "unprofessional", "hospitable", "cooperative", "uncooperative",
        "accommodating", "arrogant", "respectful", "disrespectful", "friendliest",
    ],
    "location": ["central", "convenient", "secluded", "remote", "isolated", "well-located"],
    "room": ["spacious", "roomy", "cramped"],
    "wifi": [],
    "value": ["expensive", "cheap", "overpriced", "pricey", "affordable", "inexpensive", "worth", "value-for-money", "rip-off", "ripoff", "extortionate", "overcharged", "charged", "priced"],
    "facilities": [],
    "food": ["delicious", "tasty", "tasteless", "yummy", "bland", "flavorful", "flavourful", "scrumptious", "appetizing", "stale", "inedible", "undercooked", "overcooked"],
    "noise": ["noisy", "noisier", "quiet", "quieter", "loud", "peaceful", "silent", "tranquil", "serene"],
}

# Phrases that contain an aspect word but name no aspect. "The lift was out of
# service" is about the lift, not the staff. Multi-word keywords above already
# win over their parts ("room service" is staff, not room) by longest match.
_IGNORED_PHRASES = ["out of service", "out of order", "in charge", "big fan", "huge fan", "sound sleep", "sounds good", "sounded good"]


@dataclass(frozen=True)
class AspectMention:
    aspect: str
    index: int  # token index of the first word of the keyword
    is_target: bool
    keyword: str


def _forms(word: str) -> Tuple[str, ...]:
    forms = {word, word + "s", word + "es"}
    if word.endswith("y") and len(word) > 2 and word[-2] not in "aeiou":
        forms.add(word[:-1] + "ies")
    return tuple(forms)


def _build_index() -> Dict[Tuple[str, ...], List[Tuple[str, bool]]]:
    index: Dict[Tuple[str, ...], List[Tuple[str, bool]]] = {}
    for source, is_target in ((ASPECT_TARGETS, True), (ASPECT_ATTRIBUTES, False)):
        for aspect, keywords in source.items():
            for keyword in keywords:
                words = keyword.split()
                variants = [tuple(words[:-1]) + (form,) for form in _forms(words[-1])] if is_target else [tuple(words)]
                for variant in variants:
                    index.setdefault(variant, [])
                    if (aspect, is_target) not in index[variant]:
                        index[variant].append((aspect, is_target))
    for phrase in _IGNORED_PHRASES:
        index[tuple(phrase.split())] = []
    return index


_INDEX = _build_index()
_MAX_WORDS = max(len(key) for key in _INDEX)


def find_aspect_mentions(tokens: List[str]) -> List[AspectMention]:
    """Every aspect keyword in a list of normalized tokens, longest match first."""
    mentions: List[AspectMention] = []
    i = 0
    while i < len(tokens):
        matched = False
        for size in range(min(_MAX_WORDS, len(tokens) - i), 0, -1):
            key = tuple(tokens[i:i + size])
            entries = _INDEX.get(key)
            if entries is None:
                continue
            keyword = " ".join(key)
            for aspect, is_target in entries:
                mentions.append(AspectMention(aspect, i, is_target, keyword))
            i += size
            matched = True
            break
        if not matched:
            i += 1
    return mentions


def aspects_in_order(mentions: Iterable[AspectMention]) -> List[str]:
    seen: List[str] = []
    for mention in mentions:
        if mention.aspect not in seen:
            seen.append(mention.aspect)
    return seen


def target_aspects(mentions: Iterable[AspectMention]) -> List[str]:
    """Aspects named by a noun (not only implied by an opinion word)."""
    return aspects_in_order(m for m in mentions if m.is_target)


__all__ = ["ASPECT_ORDER", "AspectMention", "find_aspect_mentions", "aspects_in_order", "target_aspects"]
