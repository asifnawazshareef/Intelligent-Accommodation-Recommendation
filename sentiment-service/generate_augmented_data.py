"""
Build data/sentiment_training.csv: HRAST hotel review sentences plus targeted
augmentation.

Augmentation covers what HRAST alone teaches badly:
- negation in informal English ("not too much good service")
- neutral facts: guests describing the room or stay without praise or
  criticism ("The room had two chairs", "Breakfast is served from 7 to 10")
- suggestions versus praise. HRAST labels requests such as "two chairs in the
  room would be good" as negative, so the model must see that "Good Wi-Fi
  would help" (a request) differs from "Good Wi-Fi helped" (praise)

HRAST cleaning: some HRAST "neutral" sentences contain both strong praise and
a strong complaint ("the staff is super friendly but the facilities are
really poor"); 41 in the current data. They are relabelled "mixed". The
classifier is trained on positive, negative and neutral only; mixed reviews
are handled by clause splitting in the app.

Sentences from data/evaluation_cases.json are never added, so that the
evaluation stays a fair test.

Run:
python generate_augmented_data.py
"""

from __future__ import annotations

import itertools
import json
import random
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
TRAINING_PATH = BASE_DIR / "data" / "sentiment_training.csv"
EVALUATION_PATH = BASE_DIR / "data" / "evaluation_cases.json"
# Optional one-time source; merged into TRAINING_PATH then removed from the repo.
HRAST_PATH = BASE_DIR / "data" / "HRAST_cleaned_for_sentiment_training.csv"

LABELS = ("positive", "negative", "neutral", "mixed")

NEGATION_PREFIXES = [
    "not",
    "not too",
    "not so",
    "not very",
    "not that",
    "not really",
    "not much",
    "never",
    "hardly",
    "barely",
]

POSITIVE_DESCRIPTORS = [
    "good",
    "great",
    "nice",
    "clean",
    "helpful",
    "friendly",
    "comfortable",
    "excellent",
    "amazing",
    "perfect",
    "worth it",
    "satisfactory",
    "pleasant",
    "fine",
    "okay",
]

HOTEL_SUBJECTS = [
    "service",
    "staff service",
    "room service",
    "hotel service",
    "customer service",
    "the service",
    "staff",
    "the staff",
    "room",
    "the room",
    "wifi",
    "the wifi",
    "breakfast",
    "the breakfast",
    "location",
    "the location",
    "facilities",
    "the facilities",
    "stay",
    "the stay",
    "experience",
    "the experience",
    "accommodation",
    "food",
    "the food",
    "cleanliness",
    "value for money",
]

POSITIVE_TEMPLATES = [
    "The {subject} was {desc}.",
    "{subject} was {desc}.",
    "Very {desc} {subject}.",
    "Really {desc} {subject}.",
    "I found the {subject} {desc}.",
    "Overall {desc} {subject}.",
    "It is a {desc} {subject}.",
    "It's a {desc} {subject}.",
    "We had a {desc} {subject}.",
    "The hotel has {desc} {subject}.",
]

NEGATIVE_TEMPLATES = [
    "The {subject} was {desc}.",
    "{subject} was {desc}.",
    "Very {desc} {subject}.",
    "Really {desc} {subject}.",
    "Poor {subject}.",
    "Bad {subject}.",
    "Terrible {subject}.",
    "Disappointing {subject}.",
    "The worst {subject} ever.",
    "Would not recommend because of {subject}.",
]

NEUTRAL_TEMPLATES = [
    "The {subject} is average.",
    "The hotel is near the {subject}.",
    "We stayed for two nights.",
    "The {subject} was acceptable.",
    "Standard {subject} for this price range.",
    "Nothing special about the {subject}.",
]

NEGATIVE_DESCRIPTORS = [
    "bad",
    "poor",
    "terrible",
    "awful",
    "horrible",
    "disappointing",
    "dirty",
    "rude",
    "slow",
    "uncomfortable",
    "overpriced",
    "noisy",
    "unreliable",
    "unacceptable",
]

# ---- Neutral facts -------------------------------------------------------
ROOM_ITEMS = [
    "two chairs", "a desk", "a wardrobe", "a sofa", "a kettle", "a fridge", "a mini fridge",
    "a safe", "a television", "a tv", "two single beds", "a double bed", "a king size bed",
    "a balcony", "a window", "two windows", "a mirror", "a ceiling fan", "an air conditioner",
    "a heater", "a microwave", "a hairdryer", "an iron", "a dining table", "a coffee table",
    "a bathtub", "a shower", "a small table", "three beds", "a bunk bed", "a writing desk",
    "a lamp", "two lamps", "a prayer mat", "a geyser", "a sofa bed", "two pillows",
    "four pillows", "a wardrobe with hangers", "a small fridge", "a sitting area",
    "a dressing table", "an electric kettle", "a telephone", "a clock", "a rug", "a cupboard",
    "a bedside table", "two armchairs", "a luggage rack", "a water dispenser", "a heater and a fan",
]
ROOM_PLACES = [
    "room", "bathroom", "suite", "apartment", "family room", "double room", "twin room",
    "deluxe room", "bedroom", "guest room", "executive room", "standard room",
]
LANDMARKS = [
    "airport", "railway station", "bus station", "city center", "city centre", "beach", "mall",
    "main market", "old town", "mosque", "lake", "river", "museum", "university", "hospital",
    "highway", "motorway", "main road", "Mall Road", "Liberty Market", "Faisal Mosque",
    "Badshahi Mosque", "Karimabad bazaar", "Clifton beach", "Daewoo terminal", "fort",
    "shopping center", "metro station", "bus stop", "park", "zoo", "stadium", "cathedral",
]
DISTANCES = [
    "5 minutes", "10 minutes", "a 15 minute walk", "20 minutes by car", "2 km", "3 kilometers",
    "500 meters", "an hour's drive", "half an hour", "a short drive", "two blocks", "1 km",
    "45 minutes", "a few kilometers", "15 minutes on foot",
]
CITIES = ["Gilgit", "Hunza", "Skardu", "Murree", "Lahore", "Karachi", "Islamabad", "Swat", "Naran", "Multan", "Peshawar", "Quetta", "Dubai", "London", "Rome", "Barcelona"]
TIMES = ["6 am", "7 am", "7:30", "8 am", "9 am", "10 am", "11 am", "noon", "12 pm", "1 pm", "2 pm", "3 pm", "4 pm", "6 pm", "8 pm", "10 pm", "11 pm", "midnight"]
COMPANIONS = ["my wife", "my husband", "our two children", "our kids", "my parents", "friends", "colleagues", "my family", "a group of friends", "my brother", "our baby", "my sister"]
PURPOSES = ["a wedding", "a business trip", "a family holiday", "a conference", "our honeymoon", "a short break", "a weekend trip", "work", "a cricket match", "a family function", "sightseeing", "a medical appointment"]
FACILITIES = ["restaurant", "pool", "gym", "spa", "garden", "rooftop terrace", "prayer room", "conference hall", "parking area", "laundry", "lounge", "cafe", "playground", "business center"]
CUISINES = ["Pakistani", "Chinese", "continental", "Italian", "Indian", "local", "Thai", "Arabic", "fast"]
FREQUENCIES = ["every day", "every two days", "every three days", "once a week", "on request", "daily"]
ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "top", "ground"]
AMOUNTS = ["500 rupees", "1000 rupees", "8000 rupees", "12000 rupees", "50 dollars", "80 euros", "100 dollars", "3000 rupees", "20 euros"]
NUMBERS = ["two", "three", "four", "five", "6", "7", "10", "one"]

FACT_TEMPLATES = [
    "The {place} had {item}.",
    "The {place} has {item}.",
    "Our {place} had {item} and {item2}.",
    "There is {item} in the {place}.",
    "There was {item} in our {place}.",
    "The {place} comes with {item}.",
    "Each {place} has {item}.",
    "The {place} had {item}, {item2} and {item3}.",
    "There are {item} and {item2} in the {place}.",
    "Our {place} was on the {ordinal} floor.",
    "The {place} is on the {ordinal} floor.",
    "The hotel is {distance} from the {landmark}.",
    "The hotel is located near the {landmark}.",
    "The hotel is located next to the {landmark}.",
    "The hotel is close to the {landmark}.",
    "The hotel is opposite the {landmark}.",
    "The {landmark} is {distance} away.",
    "It takes {distance} to reach the {landmark}.",
    "The property is in {city}.",
    "The hotel is in the center of {city}.",
    "We drove from {city} to the hotel.",
    "Breakfast is served from {time} to {time2}.",
    "Check-in is at {time}.",
    "Check-out time is {time}.",
    "The restaurant opens at {time}.",
    "The pool is open from {time} to {time2}.",
    "Dinner is served until {time}.",
    "The gym opens at {time}.",
    "Reception is open 24 hours.",
    "We checked in at {time}.",
    "We arrived at {time}.",
    "We arrived late in the evening.",
    "We stayed {number} nights.",
    "We booked a {place} for {number} nights.",
    "We travelled with {companion}.",
    "I stayed here with {companion}.",
    "We came for {purpose}.",
    "We were in {city} for {purpose}.",
    "This was our {ordinal} visit to the hotel.",
    "We booked through a travel agent.",
    "We booked online.",
    "We paid {amount} per night.",
    "The room rate was {amount} per night.",
    "Parking costs {amount} per day.",
    "The rate included breakfast.",
    "The hotel has {number} floors.",
    "The hotel has a {facility} and a {facility2}.",
    "The hotel has a {facility}.",
    "There is a {facility} on the ground floor.",
    "The hotel accepts cash and cards.",
    "Towels are changed {frequency}.",
    "Housekeeping comes {frequency}.",
    "The wifi password is given at reception.",
    "Wi-Fi is available in the lobby.",
    "The restaurant serves {cuisine} food.",
    "The menu includes {cuisine} and {cuisine2} dishes.",
    "Smoking is not allowed in the rooms.",
    "Pets are not allowed.",
    "The hotel is run by a family.",
    "The hotel was built in the {decade}s.",
    "Our room faced the {landmark}.",
    "We used the {facility} in the morning.",
    "We had dinner at the hotel restaurant.",
    "We ordered room service once.",
    "We took a taxi from the {landmark}.",
    "The booking was for {number} adults.",
    "We visited in {month}.",
    "We checked out on {day}.",
    "Our flight was at {time}.",
]
DECADES = ["1970", "1980", "1990", "2000", "2010"]
MONTHS = ["January", "March", "May", "July", "August", "October", "December", "winter", "summer", "spring"]
DAYS = ["Monday", "Tuesday", "Friday", "Saturday", "Sunday", "the last day"]

# ---- Suggestions versus praise -------------------------------------------
WISHED_ITEMS = [
    "good wifi", "faster wifi", "better wifi", "a stronger wifi signal", "a kettle",
    "a kettle in the room", "more towels", "extra pillows", "a mini fridge", "a bigger fridge",
    "better lighting", "a hairdryer", "better soundproofing", "thicker curtains", "a microwave",
    "more hangers", "a working geyser", "hot water in the morning", "a bigger breakfast",
    "more variety at breakfast", "fresh fruit at breakfast", "an elevator", "a lift",
    "more parking space", "an extra blanket", "a power backup", "a generator", "slippers",
    "toiletries", "a full length mirror", "a desk lamp", "more chairs", "two chairs in the room",
    "a sofa", "a water dispenser", "air conditioning", "a fan", "a heater",
    "room service at night", "an earlier breakfast", "late checkout", "a vegetarian option",
    "an iron", "better signage", "a shuttle to the airport", "a bigger room", "softer pillows",
    "a better mattress", "blackout curtains", "a coffee machine",
]
SUGGESTION_PATTERNS = [
    "{s} would help a lot.",
    "{s} would help.",
    "{s} would be nice.",
    "{s} would be appreciated.",
    "{s} would be great.",
    "{s} would make the stay better.",
    "{s} would improve the stay.",
    "It would be nice to have {s}.",
    "It would be better with {s}.",
    "Would have been perfect with {s}.",
    "I wish there was {s}.",
    "I wish they had {s}.",
    "Please provide {s}.",
    "They should provide {s}.",
    "The hotel should add {s}.",
    "We would have liked {s}.",
    "{s} would be a good addition.",
    "{s} would really help.",
]
PRAISE_PATTERNS = [
    "{s} helped a lot.",
    "{s} was nice.",
    "{s} was appreciated.",
    "{s} was great.",
    "{s} made the stay better.",
    "{s} really helped.",
    "We loved {s}.",
    "{s} was a nice touch.",
    "{s} was a good addition.",
    "{s} improved our stay.",
    "We were happy to find {s}.",
]
PHYSICAL_FEATURES = [
    "the bathroom", "the rooms", "the furniture", "the carpets", "the lift", "the air conditioning",
    "the shower", "the beds", "the curtains", "the lobby", "the parking", "the pool", "the kitchen",
    "the hotel", "the building", "the mattress", "the windows", "the geyser",
]
PHYSICAL_FIXES = [
    "{s} should be renovated.", "{s} should be updated.", "{s} should be cleaned more often.",
    "{s} needs to be repaired.", "{s} needs updating.", "{s} needs renovation.", "{s} could be better.",
    "{s} could be cleaner.", "{s} could use some updating.", "{s} could do with a refresh.",
    "{s} needs more attention.", "Please fix {s}.", "They should improve {s}.",
    "Management should look into {s}.", "{s} could be improved.", "Hopefully they will fix {s}.",
    "{s} should be better maintained.", "{s} needs some work.",
]
SERVICE_FEATURES = ["the staff", "the service", "reception", "the wifi", "the breakfast", "room service", "the internet", "check-in", "housekeeping", "the food"]
SERVICE_FIXES = [
    "{s} could be better.", "{s} could be faster.", "{s} should be more organised.", "{s} needs improvement.",
    "{s} needs to improve.", "They should improve {s}.", "{s} could be more helpful.", "{s} should be faster.",
    "Hopefully they will improve {s}.", "{s} needs more training.", "{s} could do better.", "{s} should be improved.",
]
SERVICE_PRAISE = [
    "{s} was very good.", "{s} was fast.", "{s} was excellent.", "{s} was well organised.",
    "{s} was very helpful.", "{s} was quick.", "{s} improved a lot since our last visit.",
]
RECOMMENDATIONS = [
    "would recommend this hotel", "i would stay here again", "we would definitely come back",
    "would love to return", "will definitely stay again", "would book again",
    "i would recommend it to friends", "we will come back next year", "would happily stay here again",
    "we would love to come back", "i would definitely recommend this place", "would stay again",
    "we will return", "highly recommend this hotel", "would recommend to families",
    "i will be back", "we will definitely be back", "would come again",
]
HABITUAL_PRAISE = [
    "the staff would always help us", "the owner would always help", "the manager would help with anything",
    "the staff would greet us every morning", "they would always help with our bags",
    "the receptionist would always smile", "the staff would always check on us",
]


def _build_negation_rows() -> list[dict]:
    rows: list[dict] = []

    for prefix, desc in itertools.product(NEGATION_PREFIXES, POSITIVE_DESCRIPTORS):
        for subject in HOTEL_SUBJECTS[:12]:
            if prefix == "not" and random.random() > 0.35:
                continue
            text = f"{subject} is {prefix} {desc}"
            rows.append({"review": text, "sentiment": "negative", "source": "negation_aug"})

    for template in POSITIVE_TEMPLATES:
        for subject, desc in itertools.product(HOTEL_SUBJECTS[:10], POSITIVE_DESCRIPTORS[:8]):
            positive = template.format(subject=subject, desc=desc).lower()
            rows.append({"review": positive, "sentiment": "positive", "source": "positive_aug"})

            for prefix in ["not", "not too", "not very", "not so", "never"]:
                neg = positive.replace(f" {desc}", f" {prefix} {desc}")
                neg = neg.replace(f"was {desc}", f"was {prefix} {desc}")
                neg = neg.replace(f"is {desc}", f"is {prefix} {desc}")
                rows.append({"review": neg, "sentiment": "negative", "source": "negation_flip"})

    for template in NEGATIVE_TEMPLATES:
        for subject, desc in itertools.product(HOTEL_SUBJECTS, NEGATIVE_DESCRIPTORS[:8]):
            rows.append(
                {
                    "review": template.format(subject=subject, desc=desc).lower(),
                    "sentiment": "negative",
                    "source": "negative_aug",
                }
            )

    for template in NEUTRAL_TEMPLATES:
        for subject in HOTEL_SUBJECTS[:8]:
            rows.append(
                {
                    "review": template.format(subject=subject).lower(),
                    "sentiment": "neutral",
                    "source": "neutral_aug",
                }
            )

    # User-reported patterns and informal Pakistani/Indian English variants
    manual = [
        ("it's not too much good service.", "negative"),
        ("its not too much good service", "negative"),
        ("not too much good service", "negative"),
        ("service is not too much good", "negative"),
        ("service not good", "negative"),
        ("not good service at all", "negative"),
        ("staff not friendly", "negative"),
        ("room not clean", "negative"),
        ("wifi not working properly", "negative"),
        ("not worth the price", "negative"),
        ("would not stay again", "negative"),
        ("do not recommend this hotel", "negative"),
        ("not happy with the service", "negative"),
        ("not satisfied with the stay", "negative"),
        ("not a good hotel", "negative"),
        ("not a pleasant experience", "negative"),
        ("not bad at all", "positive"),
        ("the room was not bad", "positive"),
        ("not too bad for the price", "positive"),
        ("service was ok but not great", "mixed"),
        ("room was clean but wifi was not good", "mixed"),
    ]

    for text, sentiment in manual:
        rows.append({"review": text, "sentiment": sentiment, "source": "manual_hard_cases"})

    return rows


def _fill(template: str, rng: random.Random) -> str:
    items = rng.sample(ROOM_ITEMS, 3)
    cuisines = rng.sample(CUISINES, 2)
    times = sorted(rng.sample(TIMES, 2), key=TIMES.index)
    facilities = rng.sample(FACILITIES, 2)
    return template.format(
        place=rng.choice(ROOM_PLACES), item=items[0], item2=items[1], item3=items[2],
        ordinal=rng.choice(ORDINALS), distance=rng.choice(DISTANCES), landmark=rng.choice(LANDMARKS),
        city=rng.choice(CITIES), time=times[0], time2=times[1], number=rng.choice(NUMBERS),
        companion=rng.choice(COMPANIONS), purpose=rng.choice(PURPOSES), amount=rng.choice(AMOUNTS),
        facility=facilities[0], facility2=facilities[1], frequency=rng.choice(FREQUENCIES),
        cuisine=cuisines[0], cuisine2=cuisines[1], decade=rng.choice(DECADES), month=rng.choice(MONTHS),
        day=rng.choice(DAYS),
    )


def _build_neutral_fact_rows(rng: random.Random, target: int = 1500) -> list[dict]:
    """Guests describing the room or stay without praising or criticising it."""
    seen: set[str] = set()
    rows: list[dict] = []
    attempts = 0
    while len(rows) < target and attempts < target * 40:
        attempts += 1
        text = _fill(rng.choice(FACT_TEMPLATES), rng)
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        rows.append({"review": text, "sentiment": "neutral", "source": "neutral_facts"})
    return rows


def _build_suggestion_rows() -> list[dict]:
    """Requests for improvement (negative) next to matching praise (positive)."""
    rows: list[dict] = []

    def capitalised(text: str) -> str:
        return text[0].upper() + text[1:]

    for item, pattern in itertools.product(WISHED_ITEMS, SUGGESTION_PATTERNS):
        rows.append({"review": capitalised(pattern.format(s=item)), "sentiment": "negative", "source": "suggestion_aug"})
    for item, pattern in itertools.product(WISHED_ITEMS, PRAISE_PATTERNS):
        rows.append({"review": capitalised(pattern.format(s=item)), "sentiment": "positive", "source": "praise_pair_aug"})
    for feature, pattern in itertools.product(PHYSICAL_FEATURES, PHYSICAL_FIXES):
        rows.append({"review": capitalised(pattern.format(s=feature)), "sentiment": "negative", "source": "suggestion_aug"})
    for feature, pattern in itertools.product(SERVICE_FEATURES, SERVICE_FIXES):
        rows.append({"review": capitalised(pattern.format(s=feature)), "sentiment": "negative", "source": "suggestion_aug"})
    for feature, pattern in itertools.product(SERVICE_FEATURES, SERVICE_PRAISE):
        rows.append({"review": capitalised(pattern.format(s=feature)), "sentiment": "positive", "source": "praise_pair_aug"})
    for text in RECOMMENDATIONS + HABITUAL_PRAISE:
        rows.append({"review": capitalised(text) + ".", "sentiment": "positive", "source": "praise_pair_aug"})
    return rows


def _relabel_mixed_neutral(hrast: pd.DataFrame) -> pd.DataFrame:
    """HRAST 'neutral' sentences that praise one thing and criticise another are mixed."""
    from clause_segmentation import segment_review
    from opinion_lexicon import score_opinion

    def is_mixed(text: str) -> bool:
        polarities = set()
        for clause in segment_review(str(text)):
            score = score_opinion(clause.text)
            if score.suggestion or (score.strong_negative and not score.strong_positive):
                polarities.add("negative")
            elif score.strong_positive and not score.strong_negative:
                polarities.add("positive")
            elif score.strong_positive and score.strong_negative:
                polarities.update({"positive", "negative"})
        return {"positive", "negative"} <= polarities

    hrast = hrast.copy()
    neutral = hrast["sentiment"] == "neutral"
    mixed = neutral & hrast["review"].apply(is_mixed)
    hrast.loc[mixed, "sentiment"] = "mixed"
    hrast.loc[mixed, "source"] = "hrast_mixed"
    return hrast


def _load_hrast() -> pd.DataFrame:
    if HRAST_PATH.exists():
        hrast = pd.read_csv(HRAST_PATH)[["review", "sentiment"]].copy()
    elif TRAINING_PATH.exists():
        existing = pd.read_csv(TRAINING_PATH)
        if "source" in existing.columns:
            existing = existing[existing["source"].isin(["hrast", "hrast_mixed"])]
        hrast = existing[["review", "sentiment"]].copy()
        # Earlier builds relabelled mixed HRAST rows; rebuild them from neutral.
        hrast.loc[hrast["sentiment"] == "mixed", "sentiment"] = "neutral"
    else:
        return pd.DataFrame(columns=["review", "sentiment", "source"])
    hrast["source"] = "hrast"
    return hrast


def _evaluation_texts() -> set[str]:
    if not EVALUATION_PATH.exists():
        return set()
    cases = json.loads(EVALUATION_PATH.read_text(encoding="utf-8"))["cases"]
    return {case["review"].strip().lower().rstrip(".!") for case in cases}


def build_training_dataset(seed: int = 42) -> pd.DataFrame:
    """Rebuild the training CSV from HRAST plus fresh augmentation."""
    random.seed(seed)
    rng = random.Random(seed)

    hrast = _relabel_mixed_neutral(_load_hrast())
    augmented = pd.DataFrame(_build_negation_rows() + _build_neutral_fact_rows(rng) + _build_suggestion_rows())
    combined = pd.concat([hrast, augmented], ignore_index=True)

    combined["review"] = combined["review"].astype(str).str.strip().str.lower()
    combined["sentiment"] = combined["sentiment"].astype(str).str.strip().str.lower()
    combined = combined[combined["sentiment"].isin(LABELS)]
    combined = combined[combined["review"].str.len() > 2]
    combined = combined.drop_duplicates(subset=["review"])

    held_out = _evaluation_texts()
    combined = combined[~combined["review"].str.rstrip(".!").isin(held_out)]

    TRAINING_PATH.parent.mkdir(parents=True, exist_ok=True)
    combined.to_csv(TRAINING_PATH, index=False)

    return combined


# Backward-compatible alias used by train_model.py
build_combined_dataset = build_training_dataset


if __name__ == "__main__":
    dataset = build_training_dataset()
    print(f"Training rows: {len(dataset)}")
    print(dataset["sentiment"].value_counts())
    if "source" in dataset.columns:
        print(pd.crosstab(dataset["source"], dataset["sentiment"]))
    print(f"Saved: {TRAINING_PATH}")
