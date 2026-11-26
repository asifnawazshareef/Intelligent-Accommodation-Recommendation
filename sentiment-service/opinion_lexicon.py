"""
Hotel-domain opinion lexicon.

`score_opinion(text)` finds every opinion expression in one clause of a review
and records where it is and whether it is positive, negative or lukewarm.

It handles:
- negation scope ("not clean", "not a single towel was clean", "not bad",
  "hardly helpful", "neither ... nor")
- idioms ("couldn't fault", "no complaints", "waste of money", "never again")
- suggestions and polite complaints ("good Wi-Fi would help", "could be
  better", "should be renovated", "needs updating", "I wish ...")
- absence ("no hot water", "there was no kettle")
- excess and degree ("too small", "a bit far", "not too far")
- words whose meaning depends on context ("the room was small" is a complaint,
  "a small fridge" is a description; "the safe" is an object, "safe area" is
  praise)

The clause segmenter uses it to decide whether a clause contains an opinion,
and the analyzer uses the positions to link each opinion to the feature it
describes.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import List, Optional, Sequence

from text_preprocessing import normalize_text

STRONG = 1.0
WEAK = 0.5

POSITIVE_STRONG = {
    "excellent", "great", "amazing", "amazingly", "awesome", "wonderful", "wonderfully",
    "fantastic", "fantastically", "fabulous", "superb", "superbly", "outstanding",
    "exceptional", "perfect", "perfectly", "lovely", "beautiful", "beautifully", "gorgeous",
    "stunning", "brilliant", "incredible", "magnificent", "marvelous", "marvellous",
    "terrific", "splendid", "phenomenal", "delightful", "charming", "nice", "nicely", "good",
    "best", "clean", "spotless", "immaculate", "pristine", "tidy", "neat", "hygienic",
    "sparkling", "comfortable", "comfy", "cozy", "cosy", "spacious", "roomy", "airy", "bright",
    "modern", "stylish", "elegant", "luxurious", "luxury", "quiet", "peaceful", "tranquil",
    "relaxing", "serene", "friendly", "helpful", "kind", "polite", "courteous", "welcoming",
    "attentive", "professional", "accommodating", "hospitable", "caring", "generous",
    "responsive", "efficient", "prompt", "promptly", "cooperative", "respectful",
    "knowledgeable", "supportive", "humble", "honest", "punctual", "thoughtful", "cheerful",
    "delicious", "tasty", "yummy", "scrumptious", "flavorful", "flavourful", "convenient",
    "central", "secure", "fast", "quick", "quickly", "speedy", "reliable", "smooth",
    "smoothly", "easy", "effortless", "seamless", "hassle-free", "enjoyable", "enjoyed",
    "enjoy", "love", "loved", "loving", "adore", "adored", "recommend", "recommended",
    "recommendable", "worth", "worthwhile", "affordable", "bargain", "happy", "glad",
    "pleased", "satisfied", "impressed", "impressive", "thankful", "grateful", "fun",
    "memorable", "pleasant", "pleasantly", "upgraded", "gem", "paradise", "heaven",
    "heavenly", "majestic", "ideal", "picturesque", "scenic", "breathtaking", "plentiful",
    "fresh", "cleanest", "friendliest", "nicest", "finest", "superior", "exquisite", "wow",
    "appreciated", "warmly", "kindly", "cleaned", "helped", "homely", "homey", "cute",
    "favourite", "favorite", "highlight", "well-equipped", "well-maintained",
    "well-located", "value-for-money", "user-friendly", "family-friendly", "fab", "flexible",
    "abundant", "unbeatable", "faultless", "flawless", "impeccable", "relaxed", "spotlessly",
    "outstandingly", "extraordinary", "inviting", "charmed", "delighted",
}

POSITIVE_WEAK = {
    "ok", "okay", "fine", "decent", "alright", "adequate", "fair", "reasonable",
    "reasonably", "sufficient", "satisfactory", "better", "maintained", "equipped",
    "working", "works", "worked", "functional", "ready", "plenty", "varied", "liked",
    "cheap", "inexpensive", "calm", "well", "improved", "updated", "renovated", "new",
    "newly", "smiling", "interested", "child-friendly", "pet-friendly", "safe", "welcome",
    "useful", "practical", "tidied", "handy", "suitable", "quickly", "superior",
}

NEGATIVE_STRONG = {
    "bad", "badly", "poor", "poorly", "terrible", "terribly", "awful", "awfully", "horrible",
    "horribly", "horrendous", "horrific", "dreadful", "atrocious", "appalling", "abysmal",
    "disgusting", "gross", "nasty", "vile", "revolting", "filthy", "dirty", "unclean",
    "grimy", "grubby", "dingy", "stained", "stains", "smelly", "stinky", "stink", "stinks",
    "stank", "stench", "odor", "odour", "musty", "moldy", "mouldy", "mold", "mould",
    "mildew", "damp", "dusty", "unhygienic", "unsanitary", "cockroach", "cockroaches",
    "roach", "roaches", "bedbugs", "bugs", "insects", "mice", "rats", "mosquitoes", "rude",
    "rudest", "unfriendly", "unhelpful", "impolite", "unprofessional", "arrogant",
    "careless", "incompetent", "ignored", "uncooperative", "disrespectful", "hostile",
    "aggressive", "lazy", "uninterested", "inattentive", "unattentive", "uncaring",
    "unresponsive", "disorganised", "disorganized", "slow", "slowly", "sluggish", "laggy",
    "broken", "broke", "faulty", "damaged", "cracked", "leaking", "leaky", "leaked",
    "malfunctioning", "unusable", "unreliable", "unstable", "intermittent", "patchy",
    "spotty", "disconnecting", "disconnected", "disconnects", "noisy", "noisier", "loud",
    "unbearable", "uncomfortable", "uncomfy", "cramped", "outdated", "shabby", "run-down",
    "rundown", "unkempt", "overpriced", "expensive", "rip-off", "ripoff", "scam",
    "disappointing", "disappointed", "disappointment", "disappoint", "underwhelming",
    "overrated", "unacceptable", "unacceptably", "unpleasant", "annoying", "annoyed",
    "irritating", "frustrating", "frustrated", "inconvenient", "useless", "worthless",
    "worst", "worse", "hate", "hated", "horrid", "dangerous", "unsafe", "insecure",
    "nightmare", "disaster", "joke", "mess", "messy", "untidy", "chaotic", "freezing",
    "stuffy", "smoky", "lacking", "lacks", "lack", "lacked", "missing", "failed", "fail",
    "fails", "failing", "failure", "crashed", "overbooked", "refused", "regret",
    "regretted", "subpar", "sub-par", "substandard", "inadequate", "insufficient",
    "overcrowded", "avoid", "beware", "wasted", "waste", "cheated", "overcharged",
    "extortionate", "unreasonable", "unhappy", "dissatisfied", "unsatisfied", "unwelcoming",
    "stale", "bland", "tasteless", "inedible", "undercooked", "overcooked", "greasy",
    "soggy", "weak", "worn", "tatty", "peeling", "rusty", "clogged", "blocked", "flooded",
    "cancelled", "canceled", "shocking", "pathetic", "ridiculous", "wrong", "lousy", "crap",
    "crappy", "sucks", "sucked", "dodgy", "sketchy", "mediocre", "hell", "creaks", "creaking",
    "squeaks", "squeaking", "stole", "stolen", "theft", "nonexistent", "non-existent", "disturbing",
    "disturbed", "disturbance", "fake", "lied", "liar", "inflexible", "outrageous", "dirt", "grime",
    "sticky", "leak", "leaks", "flooding", "infested", "infestation", "scratchy", "lumpy", "saggy",
    "sagging", "threadbare", "chipped", "unanswered", "creepy", "scary", "terrifying", "terrified",
    # Frequent misspellings in guest reviews.
    "disapointed", "dissapointed", "disapointing", "dissapointing", "disapointment", "terible",
    "horible", "uncomfterble", "dirtty", "rood",
    "ants", "exorbitant", "unpractical", "impractical", "unhygenic", "mouldy", "rubbish",
}

NEGATIVE_WEAK = {
    "pricey", "dated", "tired", "problem", "problems", "issue", "issues", "complaint",
    "complaints", "complain", "complained", "downside", "downsides", "drawback",
    "drawbacks", "unfortunately", "unfortunate", "sadly", "crowded", "busy", "tight",
    "steep", "dim", "dark", "humid", "hard", "delay", "delays", "delayed", "smell",
    "smelled", "smells", "smelt", "confusing", "difficult", "awkward", "limited", "small",
    "tiny", "old", "far", "cold", "thin", "narrow", "noise", "creaky", "squeaky", "mistake",
    "mistakes", "trouble", "lost", "weird", "rough", "unclear", "tricky", "awkwardly",
}

# Words that describe the stay without praising or criticising it.
LUKEWARM = {"acceptable", "average", "ordinary", "standard", "basic", "unremarkable", "simple", "meh"}

# Only a complaint when said about the stay ("the room was small", "an old
# carpet"), not when describing an item ("a small fridge", "the old town").
CONTEXTUAL_NEGATIVE = {
    "small", "tiny", "old", "far", "cold", "thin", "narrow", "dark", "hard", "noise",
    "smell", "smelled", "smells", "smelt", "busy", "tight", "steep", "limited", "dim",
}
# Only praise when used as an adjective ("safe area", "central location"), not
# as a noun or name ("the safe", "central station", "ask them to clean the room").
CONTEXTUAL_POSITIVE = {
    "safe", "working", "works", "worked", "new", "ready", "well", "kind", "fair", "central",
    "clean", "welcome", "superior", "quiet", "glad", "cheap", "luxury", "luxurious",
}
# "cheap" praises a price but criticises an object ("a cheap mattress").
CHEAP_OBJECTS = {
    "mattress", "mattresses", "furniture", "materials", "material", "quality", "towels", "sheets",
    "plastic", "fittings", "one", "ones", "looking", "feel", "decor", "linen", "pillows", "beds",
    "bed", "carpet", "carpets", "toiletries", "shampoo", "soap", "construction", "finish", "doors",
}
# Lukewarm words that also name a room type ("standard room", "basic rate").
CONTEXTUAL_LUKEWARM = {"standard", "basic"}
ROOM_TYPE_FOLLOWERS = {"room", "rooms", "double", "twin", "single", "king", "queen", "suite", "rate", "rates", "price", "size", "category"}
CENTRAL_NAMES = {
    "station", "heating", "park", "square", "bus", "railway", "market", "street", "avenue", "asia",
    "europe", "america", "london", "air", "plaza", "mosque", "hall", "library", "bank", "post",
    "police", "train", "metro", "district",
}
# A boundary token kept from punctuation. Negation never crosses it.
BOUNDARY = ","

# Nouns that turn a context word into a complaint when it describes them.
COMPLAINT_HEADS = {
    "room", "rooms", "bathroom", "bathrooms", "washroom", "bed", "beds", "space", "shower",
    "showers", "portion", "portions", "towel", "towels", "wall", "walls", "pool", "window",
    "windows", "breakfast", "lift", "elevator", "parking", "tv", "wardrobe", "closet",
    "toilet", "kitchen", "mattress", "mattresses", "pillow", "pillows", "food", "water",
    "coffee", "tea", "eggs", "meal", "meals", "dishes", "stairs", "corridor", "corridors",
    "hallway", "furniture", "suite", "lobby", "reception", "service", "carpet", "carpets",
    "fittings", "bathtub", "sheets", "blankets", "options", "choice", "selection",
}

# Words between a negator (or degree word) and the opinion it governs.
TRANSPARENT = {
    "very", "really", "so", "that", "quite", "at", "all", "much", "the", "a", "an",
    "extremely", "super", "particularly", "especially", "overly", "totally", "completely",
    "fully", "entirely", "exactly", "always", "even", "as", "been", "be", "being", "is",
    "was", "were", "are", "am", "it", "they", "any", "too", "most", "more", "bit", "little",
    "remotely", "pretty", "fairly", "rather", "somewhat", "slightly", "properly", "seem",
    "seemed", "seems", "look", "looked", "feel", "felt", "get", "got", "of", "our", "my",
    "their", "this", "one", "single", "do", "did", "does", "have", "has", "had", "would",
    "could", "should", "will", "can", "we", "i", "you", "he", "she", "there", "anything",
    "everything", "particularly", "terribly", "awfully",
}

BE_AND_DEGREE = {
    "is", "was", "were", "are", "am", "be", "been", "being", "seemed", "seems", "looked",
    "looks", "felt", "feels", "very", "quite", "rather", "really", "so", "too", "extremely",
    "pretty", "fairly", "slightly", "somewhat", "bit", "little", "incredibly", "super",
    "kinda", "relatively", "way", "awfully", "terribly", "bit", "real", "abit", "bloody",
}

DIMINISHERS = {"bit", "little", "slightly", "somewhat", "rather", "kinda", "relatively", "fairly", "pretty", "abit"}

# Descriptive adjectives that "too" or a diminisher turns into a complaint.
DESCRIPTIVE = {
    "small", "tiny", "big", "large", "far", "close", "hot", "cold", "warm", "long", "short",
    "expensive", "pricey", "high", "low", "loud", "soft", "hard", "firm", "dark", "bright",
    "strong", "weak", "busy", "crowded", "early", "late", "slow", "narrow", "steep",
    "tight", "old", "much", "many", "few", "basic", "dated", "thin", "simple", "spicy",
    "salty", "sweet", "oily", "noisy", "dirty", "humid", "stuffy", "dim", "cramped",
    "limited", "tired", "worn", "outdated",
}

NEGATORS = {"not", "no", "never", "hardly", "barely", "scarcely", "nothing", "none", "nobody", "nowhere", "neither", "nor", "without"}
NEGATOR_SCOPE = {"neither": 5, "nor": 5, "nothing": 2}
DEFAULT_NEGATOR_SCOPE = 3

# "like" is a verb of praise only after a subject or auxiliary
# ("we really liked", "I did not like"), never in "smelled like smoke".
LIKE_SUBJECTS = {
    "i", "we", "they", "you", "really", "did", "do", "does", "not", "would", "definitely",
    "kids", "children", "everyone", "guests", "also", "both", "all", "just", "particularly",
    "especially", "absolutely", "truly", "family", "wife", "husband", "parents", "friends",
}

AMENITIES = (
    r"hot water|water|towels?|soap|shampoo|toilet paper|tissues?|wifi|internet|signal|"
    r"network|ac|air conditioning|air conditioner|heating|heater|fans?|electricity|power|"
    r"backup|generator|ups|lights?|lift|elevator|parking|breakfast|kettle|fridge|"
    r"refrigerator|tv|television|hairdryer|hair dryer|iron|blankets?|pillows?|curtains?|"
    r"windows?|bin|mirror|hangers?|wardrobe|closet|chairs?|desk|restaurant|pool|gym|geyser|"
    r"room service|housekeeping|cleaning|toiletries|slippers|coffee|tea|sugar|milk|menu|"
    r"reception|receptionist|help|response|plugs?|sockets?|outlets?|sink|shower|bathtub|"
    r"lock|soundproofing|insulation|sheets?|bed linen|linen|cutlery|plates?|cups?|glasses|"
    r"dustbin|toilet seat|bulbs?|remote|channels?|staff|security|guard|lobby|lounge|"
    r"hot shower|warm water|drinking water|mosquito net|screen|ventilation"
)

PERSON_WORDS = {
    "staff", "he", "she", "they", "owner", "owners", "manager", "managers", "host", "hosts",
    "receptionist", "receptionists", "waiter", "waiters", "waitress", "team", "everyone",
    "people", "guys", "employees", "management", "reception", "guard", "driver", "everybody",
}


@dataclass
class Opinion:
    index: int
    polarity: int  # +1 positive, -1 negative, 0 lukewarm (neither praise nor complaint)
    strength: float
    kind: str
    text: str


@dataclass
class OpinionScore:
    tokens: List[str]
    opinions: List[Opinion] = field(default_factory=list)

    def _polar(self) -> List[Opinion]:
        return [o for o in self.opinions if o.polarity != 0 and o.kind != "hypothetical"]

    @property
    def positive(self) -> float:
        return sum(o.strength for o in self._polar() if o.polarity > 0)

    @property
    def negative(self) -> float:
        return sum(o.strength for o in self._polar() if o.polarity < 0)

    @property
    def strong_positive(self) -> bool:
        return any(o.polarity > 0 and o.strength >= STRONG for o in self._polar())

    @property
    def strong_negative(self) -> bool:
        return any(o.polarity < 0 and o.strength >= STRONG for o in self._polar())

    @property
    def lukewarm(self) -> bool:
        return any(o.polarity == 0 for o in self.opinions)

    @property
    def suggestion(self) -> bool:
        return any(o.kind == "suggestion" for o in self.opinions)

    @property
    def has_opinion(self) -> bool:
        return bool(self.opinions)

    @property
    def polar(self) -> bool:
        return bool(self._polar())


def _c(pattern: str) -> re.Pattern:
    return re.compile(pattern)


_COMPARATIVES = (
    r"better|improved|cleaner|faster|bigger|larger|quieter|stronger|warmer|cooler|softer|"
    r"firmer|cheaper|nicer|friendlier|quicker|brighter|newer|updated|upgraded|renovated|"
    r"refreshed|fresher|tastier|healthier|closer|safer|easier|clearer|wider|higher|lower|"
    r"more \w+|improvement|updating|upgrading|renovation|refurbishment|attention|work|"
    r"cleaning|maintenance|a refresh|a makeover|a facelift|some tlc|tlc|some love|"
    r"a lick of paint|a clean|a good clean|a deep clean|redecorating|repainting"
)
_FIX_VERBS = (
    r"reconstruct\w*|rebuild\w*|revamp\w*|redo\w*|rework\w*|"
    r"improv\w*|upgrad\w*|updat\w*|renovat\w*|refurbish\w*|repair\w*|fix\w*|clean\w*|"
    r"replac\w*|chang\w*|consider\w*|provid\w*|offer\w*|add\w*|install\w*|train\w*|"
    r"invest\w*|redecorat\w*|repaint\w*|paint\w*|moderni[sz]\w*|maintain\w*|"
    r"look into|work on|pay (?:more )?attention|hire\w*|reduc\w*|lower\w*|increas\w*|"
    r"think about|do something|take care|address\w*|serviced|sort\w* out|make sure|ensure"
)
_IMPROVEMENT_NOUNS = (
    r"reconstruct\w*|rebuild\w*|revamp\w*|upkeep|"
    r"improv\w*|updat\w*|upgrad\w*|renovat\w*|refurbish\w*|repair\w*|fix\w*|clean\w*|"
    r"replac\w*|attention|work|maintenance|training|paint\w*|moderni[sz]\w*|investment|"
    r"overhaul|makeover|facelift|refresh\w*|tlc|soundproofing|insulation"
)

# Each phrase: (pattern, polarity, strength, kind). Order matters: a phrase
# cannot claim words an earlier phrase already claimed. Kind "filler" claims
# words without adding an opinion, so that "no doubt the best" is not negated.
PHRASES: Sequence[tuple[re.Pattern, int, float, str]] = [
    # ---- Fixed expressions that carry no opinion of their own ----
    (_c(r"\b(?:no doubt|without a doubt|without doubt|no wonder|no matter|not to mention|if not|no later than|not sure|whether or not|no smoking|non smoking|no idea|as well|nothing short of|worth (?:mentioning|noting|knowing|considering|bearing in mind)|no need to (?:\w+ )?(?:worry|bring|pay|take|book))\b"), 0, 0.0, "filler"),

    # ---- Explicit negative recommendations (before the positive ones) ----
    (_c(r"\b(?:would|will|could|should|do|did|can)(?: \w+)? not (?:\w+ ){0,2}recommend\w*"), -1, STRONG, "idiom"),
    (_c(r"\bnever (?:again|coming back|come back|return\w*|stay\w* (?:here |there )?again|go\w* back|book\w* again)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:would|will) not (?:\w+ )?(?:stay|come|go|return|book|visit)\w*(?: (?:here|there|again|back))*\b"), -1, STRONG, "idiom"),

    # ---- Praise that looks like a request or a negation ----
    (_c(r"\b(?:i|we) (?:really |only )?wish(?:ed)? (?:we|i) (?:could|had) (?:have )?(?:stayed|stay|come|spent|booked|extended)(?: \w+)? (?:longer|more|again|back|another)\b"), 1, STRONG, "idiom"),
    (_c(r"\bwould (?:have )?(?:liked|loved|love|like) to (?:have )?(?:stay|stayed|spend|spent|remain|remained) (?:\w+ ){0,2}(?:longer|more|forever|another)\b"), 1, STRONG, "idiom"),
    (_c(r"\bcan not say enough (?:good|nice|great|positive|wonderful)\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:can|could) not (?:have )?(?:been |be )(?:any )?worse\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:can|could) not (?:\w+ )?(?:fault|complain|ask for (?:more|better|anything more|a better \w+)|be (?:any )?(?!further|farther)(?:\w{3,}ier|\w{3,}er|better|more \w+)|"
        r"have been (?:any )?(?!further|farther)(?:\w{3,}ier|\w{3,}er|better|more \w+)|recommend (?:\w+ ){0,3}enough|wait to (?:come back|return|go back|stay again|visit again))\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:no|zero|not a single|not one|not any|never any|never had any|did not have any|had no|without any) (?:\w+ )?(?:complaints?|problems?|issues?|regrets?|faults?|negatives?|worries|hassles?|trouble|surprises)\b"), 1, STRONG, "idiom"),
    (_c(r"\bnothing (?:to complain about|bad to say|negative to say|to fault|to dislike|was too much trouble|is too much trouble|was a problem|went wrong|was wrong)\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:did not|does not|never) (?:\w+ )?(?:disappoint|let us down|let me down|fail to impress)\b"), 1, STRONG, "idiom"),
    # "not bad" is clear (if mild) praise. It is STRONG so that the word model,
    # which sees the token "bad", cannot overturn it.
    (_c(r"\bnot (?:too |that |so |at all |half )?bad(?: at all)?\b"), 1, STRONG, "idiom"),
    # "little noise" means almost none; "a little noise" is a complaint.
    (_c(r"\b(?:no|without any|without|(?<!a )little) (?:\w+ )?(?:noise|smell|bugs|stains|dirt|dust|hassle|fuss|trouble|delays?|waiting|queues?)\b"), 1, STRONG, "idiom"),
    (_c(r"\bmet (?:all )?(?:of )?(?:our|my|the|all) (?:\w+ )?(?:needs|requirements)\b|\b(?:more than|beyond) enough\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:would|will) (?:\w+ ){0,2}(?:recommend|stay (?:here |there )?again|come back|return|go back|be back|book (?:\w+ )?again|visit again|love to (?:come back|return|stay|visit|go back))\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:you|everyone|anyone|guests?|travell?ers|families) (?:should|must) (?:definitely |really |absolutely |surely |all )?(?:stay|visit|try|book|go|come|check)\b"), 1, STRONG, "idiom"),
    (_c(r"\ba must(?: visit| stay| see| try)?\b|\bmust[ -](?:visit|stay|see|try)\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:always|happy|willing|ready|eager|quick|keen|glad) (?:\w+ )?(?:to )?help\w*\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:helped|helps|helping) (?:us |me |them )?(?:a lot|so much|greatly|immensely|tremendously|a great deal|enormously|massively)\b"), 1, STRONG, "idiom"),

    # ---- Suggestions and polite complaints: the guest asks for an improvement ----
    (_c(r"\b(?:would|could|might) (?:really |definitely |greatly |also |certainly |surely |massively |hugely )?(?:have )?"
        r"(?:help|helped|improve|improved|make (?:\w+ ){0,3}(?:better|nicer|perfect|easier|ideal|great|more \w+)|be (?:a |an )?(?:\w+ )?(?:improvement|plus|bonus|nice touch|good idea))\b"), -1, STRONG, "suggestion"),
    (_c(r"\bwould (?:be|have been) (?:so |really |very |much |even |a lot |far |way |abit |slightly )?"
        r"(?:nice|good|great|better|helpful|useful|appreciated|ideal|perfect|lovely|welcome|wonderful|excellent|"
        r"beneficial|convenient|preferable|nicer|easier|more \w+|an improvement|a plus|a bonus|a good idea|great to have|nice to have)\b"
        r"(?! (?:place|hotel|choice|option|spot|base|location|stay|destination|venue|for (?:families|couples|business|anyone|everyone|a|those|travellers|travelers|groups|kids|children|solo)))"), -1, STRONG, "suggestion"),
    (_c(r"\bwould (?:\w+ )?(?:make|have made) (?:\w+ ){0,3}(?:perfect|better|nicer|easier|ideal|more \w+|great)\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:should|ought to|must|needs? to|need to|needed to) (?:really |definitely |seriously |also |urgently |honestly |probably )?(?:be )?(?:" + _FIX_VERBS + r"|cleaner|better|more \w+|bigger|faster|quieter|stronger)\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:could|can|might) (?:be|have been|do with|use|need) (?:abit |a little |a lot |much |some |slightly |way |far |a little abit |a few |an? )?(?:" + _COMPARATIVES + r")\b"), -1, STRONG, "suggestion"),
    (_c(r"(?<!you )(?<!if )\b(?:in )?need(?:s|ed)? (?:of )?(?:a |an |some |serious |urgent |a good |a lot of |major |proper |abit of |an urgent )?(?:" + _IMPROVEMENT_NOUNS + r")\b"), -1, STRONG, "suggestion"),
    (_c(r"(?<!you )(?<!if )\bneed(?:s|ed)? (?:more|better|extra|additional|newer|bigger) \w+"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:i|we) (?:really |honestly |just |only )?(?:wish|wished)\b|\bif only\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:would|could) (?:have )?(?:liked|preferred|prefer|appreciate|appreciated|have appreciated|love to see|like to see|like more|like a|like an|like some|like better|like them to)\b"), -1, STRONG, "suggestion"),
    # "would like air conditioning", but not "would like to come back / thank the staff".
    (_c(r"\bwould like (?!to (?:come|return|stay|thank|visit|recommend|say|mention|go|express|book|add|point|share|highlight|praise|congratulate)\b)\w+"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:would|could|might) (?:really |greatly |definitely )?benefit from\b"), -1, STRONG, "suggestion"),
    (_c(r"\bcould have (?:\w+ )?(?:arranged|done|told|informed|offered|given|provided|warned|mentioned|made|cleaned|fixed|helped|explained|upgraded|checked|prepared|replaced|changed|tried|asked|organi[sz]ed|communicated)\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:expected|expect|expecting) (?:\w+ ){0,3}to (?:have|be|get|include|provide|offer|find)\b"), -1, WEAK, "idiom"),
    (_c(r"\b(?:please|kindly) (?:\w+ )?(?:" + _FIX_VERBS + r")\b"), -1, STRONG, "suggestion"),
    (_c(r"\bhopefully (?:\w+ ){0,4}(?:fix|improv|upgrad|chang|updat|repair|renovat|add|get|sort|address|better|clean)\w*"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:suggest|suggestion|advise|advice|tip for (?:the )?(?:management|hotel|owners?)|recommendation (?:to|for) (?:the )?(?:management|hotel|owners?)|recommend (?:that )?(?:they|the hotel|the management|management|the owners?|owners?))\b(?: \w+){0,6} (?:" + _FIX_VERBS + r")\b"), -1, STRONG, "suggestion"),
    (_c(r"\broom for improvement\b|\bscope for improvement\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:some|a little|more|abit of|a lot of) work on (?:\w+ )?(?:improv|updat|upgrad|the)\w*"), -1, STRONG, "suggestion"),
    (_c(r"\bwould be worth (?:\w+ ){0,2}(?:bigger|better|upgrad\w*|extra|more|larger)\b"), -1, STRONG, "suggestion"),
    (_c(r"\bdeserves? (?:a |some )?(?:\w+ )?(?:clean\w*|renovat\w*|refurbish\w*|updat\w*|upgrad\w*|repair\w*|attention)\b"), -1, STRONG, "suggestion"),

    # ---- Absence of an amenity ("no hot water", "there was no kettle") ----
    (_c(r"\b(?:no|not any|not even (?:a|an|one)|zero|lack of|lacking|lacked|lacks|missing|absence of|"
        r"there (?:is|was|were|are) (?:no|not any)|did not have (?:a |an |any )?|does not have (?:a |an |any )?|"
        r"do not have (?:a |an |any )?|had no|has no|have no|without any) (?:\w+ ){0,2}?(?:" + AMENITIES + r")\b"), -1, STRONG, "absence"),

    # ---- Other complaints ----
    (_c(r"\b(?:waste|wasted) (?:of )?(?:\w+ )?(?:money|time|rupees)\b"), -1, STRONG, "idiom"),
    (_c(r"\brip ?off\b|\bstay away\b|\bkeep away\b|\blook elsewhere\b|\bdo not (?:stay|book|go) (?:here|there)\b"), -1, STRONG, "idiom"),
    (_c(r"\bavoid (?:this|the|it|at all costs)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:left|leaves|leave) (?:\w+ ){0,2}to be desired\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:not|never) (?:up ?to|upto) (?:the )?(?:mark|standard|standards|par|expectations?)\b"), -1, STRONG, "idiom"),
    (_c(r"\bbelow (?:average|par|standard|standards|expectations?)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:did not|does not|do not|failed to|fail to|fails to|not) (?:\w+ )?(?:meet|match|live up to) (?:\w+ ){0,2}expectations?\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:expected|expect|expecting) (?:much |a lot |a little |abit |far |way )?(?:more|better)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:was|were|is|are) supposed to\b"), -1, WEAK, "idiom"),
    (_c(r"\b(?:had|have|has|having) to (?:wait|ask|call|complain|chase|remind|change rooms|move rooms|beg|pay extra|request|go down|fix|clean|carry|fight|argue|search)\w*\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:had|have|has|having) to pay (?:\w+ )?(?:for|to use) (?:the |a |an )?(?:parking|breakfast|wifi|internet|towels|water|safe|ac|air conditioning|elevator|lift|pool|gym|sauna|spa|cleaning|luggage|everything|extra)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:waited|waiting|wait|took|takes|taking) (?:us )?(?:for )?(?:over |more than |almost |nearly |about |around )?(?:an hour|half an hour|hours|ages|forever|\d+ (?:minutes|mins|hours|hrs))\b"), -1, STRONG, "idiom"),
    (_c(r"\bwould be (?:\w+ )?recommended to (?:" + _FIX_VERBS + r"|remove\w*)\b"), -1, STRONG, "suggestion"),
    (_c(r"\b(?:no one|nobody|noone|none of them) (?:\w+ ){0,1}(?:answered|responded|replied|came|helped|showed up|bothered|cared|listened|picked up|spoke)\b"), -1, STRONG, "idiom"),
    (_c(r"\bout of (?:order|service)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:stopped|stops|keeps? stopping) working\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:not|never|barely|hardly|rarely) (?:\w+ )?(?:work|works|working|worked|functioning|functional)\b"), -1, STRONG, "idiom"),
    (_c(r"\bnothing (?:\w+ )?(?:worked|works|working|functioned)\b"), -1, STRONG, "idiom"),
    (_c(r"\bkept (?:disconnecting|dropping|cutting out|going off|failing|breaking)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:it|this) (?:is|was) (?:a )?(?:pity|shame)\b|\btoo bad\b"), -1, STRONG, "idiom"),
    (_c(r"\bhairs? (?:in|on) the (?:\w+ )?(?:shower|sink|bed|bathroom|floor|towels?|pillows?|sheets?|bath|toilet|room)\b"), -1, STRONG, "idiom"),
    (_c(r"\bsmel(?:led|t|ls|l) (?:of|like) (?!fresh|flowers|roses|lavender|jasmine|heaven|home|new\b)\w+"), -1, STRONG, "idiom"),
    (_c(r"\b(?:thin|paper thin|paper-thin) walls?\b|\bwalls? (?:are|were|is|was) (?:\w+ )?thin\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:street|traffic|road|construction|outside|constant|loud|lots of|a lot of|so much|terrible|unbearable|horrible|awful|excessive|some) noise\b|\bnoise from\b"), -1, STRONG, "idiom"),
    (_c(r"\bcould (?:hear|smell) (?:\w+ ){0,2}(?:everything|every word|neighbou?rs|people|traffic|music|the street|the road|smoke|cigarettes?)\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:power|electricity|load) (?:cuts?|shedding|outages?|failures?)\b"), -1, STRONG, "idiom"),
    (_c(r"\bnot (?:even )?(?:\w+ )?(?:ready|replaced|changed|cleaned|serviced|fixed|repaired|refilled|made up)\b"), -1, STRONG, "idiom"),
    (_c(r"\bnot (?:\w+ )?(?:included|provided|available)\b"), -1, WEAK, "idiom"),
    (_c(r"\bnon existent\b|\bmade fun of\b"), -1, STRONG, "idiom"),
    (_c(r"\b(?:smaller|tinier|older|dirtier|noisier|worse|darker|further|farther) than (?:\w+ ){0,3}(?:expected|anticipated|advertised|pictured|shown|described|photos|pictures|it looked|it looks)\b"), -1, STRONG, "idiom"),
    (_c(r"(?<!a )\blittle (?:\w+ )?(?:lighting|light|space|storage|choice|variety|selection|hot water|water pressure|pressure|information|help|attention|effort|care)\b"), -1, STRONG, "idiom"),

    # ---- Other praise ----
    (_c(r"\b(?:better|nicer|cleaner|bigger|more comfortable|more spacious|more \w+) than (?:we |i )?(?:expected|anticipated|imagined|hoped|thought)\b"), 1, STRONG, "idiom"),
    (_c(r"\bexceed\w* (?:\w+ ){0,2}expectations?\b|\bbeyond (?:\w+ ){0,1}expectations?\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:met|meets|matched|lived up to) (?:\w+ ){0,2}expectations?\b"), 1, WEAK, "idiom"),
    (_c(r"\bnever (?:\w+ ){0,4}(?:better|nicer|cleaner|friendlier|more comfortable|more helpful|more welcoming)\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:solved|fixed|resolved|sorted|handled|addressed|dealt with) (?:\w+ ){0,3}(?:problem|issue|complaint|it|everything|request)s?\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:highly|strongly|warmly|definitely|totally|absolutely|100) recommend\w*\b"), 1, STRONG, "idiom"),
    (_c(r"\bvalue for (?:the )?money\b|\bbang for (?:the |your )?buck\b"), 1, WEAK, "idiom"),
    (_c(r"\bworth (?:it|the (?:money|price|cost|stay|visit|trip)|every (?:penny|rupee|cent|dollar))\b"), 1, STRONG, "idiom"),
    (_c(r"\bwell (?:maintained|equipped|kept|organi[sz]ed|located|run|managed|appointed|cleaned|done|designed|furnished|presented|looked after)\b"), 1, STRONG, "idiom"),
    (_c(r"\bwarm (?:welcome|hospitality|reception|staff|people|greeting)\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:strong|stable) (?:wifi|signal|connection|internet|network)\b|\b(?:wifi|signal|connection|internet|network) (?:was|is|were) (?:very |really |super )?(?:strong|stable)\b"), 1, STRONG, "idiom"),
    (_c(r"\bupgraded (?:us|me|our room|our booking)\b|\bfree upgrade\b"), 1, STRONG, "idiom"),
    (_c(r"\b(?:thank you|thanks|kudos|hats off|shout out|special mention)\b"), 1, STRONG, "idiom"),
    (_c(r"\bhome away from home\b|\bfelt (?:at|like) home\b|\bmade (?:us|me|our stay) (?:feel )?(?:welcome|special|comfortable|at home)\b"), 1, STRONG, "idiom"),
    (_c(r"\bspot on\b|\btop[ -]notch\b|\bsecond to none\b|\bon point\b|\bfirst[ -]class\b|\babove and beyond\b|\bout of (?:their|his|her|the) way\b|\bfive[ -]star\b|\b5[ -]star\b"), 1, STRONG, "idiom"),
    (_c(r"\bfree (?:parking|breakfast|wifi|shuttle|water|drinks|cancellation|tea|coffee|snacks|transfer|pickup)\b"), 1, WEAK, "idiom"),

    # ---- Lukewarm: neither praise nor complaint ----
    (_c(r"\bnothing (?:special|fancy|extraordinary|exceptional|remarkable|out of the ordinary|to write home about|spectacular|great|amazing|unusual)\b"), 0, WEAK, "lukewarm"),
    (_c(r"\bas (?:expected|described|advertised|pictured|shown|listed|stated|booked)\b"), 0, WEAK, "lukewarm"),
    (_c(r"\bno[ -]frills\b|\bso[ -]so\b|\b(?:about|around|just|pretty|fairly|quite) average\b|\bmiddle of the road\b|\bnot great not bad\b|\bnot bad not great\b"), 0, WEAK, "lukewarm"),
]

PHRASE_NEGATORS = {"not", "never", "no", "hardly", "barely", "nothing"}
# "I don't think / feel / believe ..." negates the whole clause that follows.
RAISING_VERBS = {"think", "feel", "believe", "find", "say", "consider"}
_SELF_NEGATED = ("not ", "never ", "no ", "nothing ", "nobody ", "none ", "without ", "zero ", "did not", "does not", "do not", "had no", "can not", "could not")


def _token_spans(text: str) -> List[tuple[int, int]]:
    return [(m.start(), m.end()) for m in re.finditer(r"\S+", text)]


def _span_to_tokens(spans: List[tuple[int, int]], start: int, end: int) -> List[int]:
    return [i for i, (s, e) in enumerate(spans) if s < end and e > start]


def lexicon_polarity(token: str) -> Optional[tuple[int, float]]:
    """Polarity and strength of a single word, or None when it is not an opinion word."""
    if token in POSITIVE_STRONG:
        return 1, STRONG
    if token in NEGATIVE_STRONG:
        return -1, STRONG
    if token in POSITIVE_WEAK:
        return 1, WEAK
    if token in NEGATIVE_WEAK:
        return -1, WEAK
    if token in LUKEWARM:
        return 0, WEAK
    return None


_CLAUSE_PUNCTUATION = re.compile(r"\s*[,;:()\[\]!?]+\s*|\s+-\s+")


def normalize_for_lexicon(text: str) -> str:
    """normalize_text, but commas and similar marks survive as a boundary token.

    The classifier ignores punctuation, but negation must not cross it: in
    "little to no public transport, expensive parking" the "no" must not
    reach "expensive".
    """
    chunks = [normalize_text(chunk) for chunk in _CLAUSE_PUNCTUATION.split(str(text))]
    return f" {BOUNDARY} ".join(chunk for chunk in chunks if chunk)


def _neighbours(tokens: List[str], i: int) -> tuple[str, str]:
    prev = tokens[i - 1] if i > 0 else ""
    nxt = tokens[i + 1] if i + 1 < len(tokens) else ""
    return ("" if prev == BOUNDARY else prev), ("" if nxt == BOUNDARY else nxt)


def _is_contextual_complaint(tokens: List[str], i: int) -> bool:
    """True when a context word ("small", "old", "far", "smell") is said as a complaint."""
    word = tokens[i]
    prev, nxt = _neighbours(tokens, i)

    if word == "old" and nxt in {"town", "city", "quarter", "fort", "port", "market", "bazaar", "part", "centre", "center", "building", "buildings", "style", "fashioned", "world", "friend", "friends"}:
        return False
    if word == "far":
        if prev in {"so", "as", "by"} or nxt in {"more", "less", "better", "too", "as"}:
            return False
        return prev in BE_AND_DEGREE or nxt in {"from", "away", "out"}
    if word in {"noise", "smell", "smelled", "smells", "smelt"}:
        # In reviews a free-standing "smell" or "noise" is a complaint ("there was
        # a smell", "the noise at night"); "no noise" is handled as praise earlier.
        return prev not in {"no", "any", "without", "little", "the", "of"} or nxt in {"was", "were", "is", "from", "at", "in", "of", "outside"}
    if nxt in COMPLAINT_HEADS:
        return True
    if prev in BE_AND_DEGREE:
        return True
    # A bare predicate left after clause splitting: "clean but | small",
    # "small | but clean", "quiet and | tiny".
    if (prev == "" and nxt in {"", "and", "or", "though", "too", "enough", "however", "but"}) or (prev in {"and", "but", "yet", "though", "or"} and nxt == ""):
        return True
    return False


def _is_contextual_praise(tokens: List[str], i: int) -> bool:
    """True when "safe", "new", "well" and similar words are said as praise."""
    word = tokens[i]
    prev, nxt = _neighbours(tokens, i)
    if word == "central":
        return nxt not in CENTRAL_NAMES
    if word == "superior":
        # "the superior king", "booked a superior room" name a room type.
        return nxt not in ROOM_TYPE_FOLLOWERS | {"one", "king", "deluxe"} and prev not in {"a", "the", "our", "booked", "as"}
    if word == "quiet":
        # "people saying be quiet", "asked us to keep quiet" quote someone.
        return not (prev in {"be", "keep", "stay"} and (i < 2 or tokens[i - 2] in {"saying", "said", "told", "asked", "to", "us", "please", BOUNDARY}))
    if word == "glad":
        # "glad to leave", "glad to check out" are complaints in disguise.
        return not (nxt == "to" and any(t in {"leave", "go", "out", "get", "move", "escape"} for t in tokens[i + 2:i + 7]))
    if word == "cheap":
        return nxt not in CHEAP_OBJECTS
    if word in {"luxury", "luxurious"}:
        # "not a luxury hotel" describes the category, it is not a complaint.
        return not (prev in {"a"} and nxt in {"hotel", "hotels", "resort", "place", "stay"})
    if word == "clean":
        # "ask them to clean the room", "they did clean up" use the verb, not praise.
        # "poor clean" means poor cleaning: the noun, already criticised by "poor".
        verb_before = prev in {"to", "would", "will", "should", "must", "please", "can", "could", "did", "didnt", "nobody", "never", "poor", "bad", "terrible", "awful", "horrible"}
        object_after = nxt in {"the", "our", "my", "up", "it", "them", "their", "his", "her", "your", "everything", "service"}
        return not (verb_before or object_after)
    if word == "welcome":
        return nxt in {"", "drink", "drinks", "gift", "and", "retreat", "change", "break", "surprise"} or prev in BE_AND_DEGREE | {"warm", "a", "very"}
    if word == "safe":
        return prev not in {"a", "the", "in-room", "room", "electronic", "digital", "small"} and nxt not in {"box", "deposit", "code"}
    if word == "kind":
        return nxt != "of" and prev not in {"what", "any", "some", "this", "that", "every", "one", "the", "a"}
    if word == "fair":
        return nxt not in {"enough", "share"}
    if word == "well":
        return prev != "as"
    if word in {"working", "works", "worked"}:
        # "everything worked", "the wifi was working" vs "we worked from the room".
        return not any(t in {"i", "we", "he", "she", "they", "you"} for t in tokens[max(0, i - 3):i])
    if word == "new":
        return prev in BE_AND_DEGREE or nxt in {"and", "furniture", "building", "rooms", "room", "beds", "mattress", "hotel", "property", "bathroom", "carpets"}
    if word == "ready":
        return prev in BE_AND_DEGREE or prev in {"already", "early"}
    return True


def score_opinion(text: str, *, normalized: bool = False) -> OpinionScore:
    """Find opinion expressions in one clause of a review."""
    norm = text if normalized else normalize_for_lexicon(text)
    norm = re.sub(r"\b(?:kind|sort) of\b", "kinda", norm)
    norm = re.sub(r"\ba ?bit\b", "abit", norm)
    tokens = norm.split()
    score = OpinionScore(tokens=tokens)
    if not tokens:
        return score

    spans = _token_spans(norm)
    claimed: set[int] = set()
    absence_ends: set[int] = set()

    for pattern, polarity, strength, kind in PHRASES:
        for match in pattern.finditer(norm):
            covered = _span_to_tokens(spans, match.start(), match.end())
            if not covered or any(i in claimed for i in covered):
                continue
            first = covered[0]
            phrase = match.group(0)
            final_polarity, final_strength = polarity, strength

            if kind == "suggestion" and re.match(r"(?:would|could|might) (?:\w+ )?(?:have )?help", phrase):
                subject = tokens[max(0, first - 3):first]
                if any(word in PERSON_WORDS for word in subject):
                    # "The staff would help you with anything" is habitual praise, not a request.
                    continue

            negators_before = [j for j in range(max(0, first - 2), first) if tokens[j] in PHRASE_NEGATORS and j not in claimed]
            # "I did not feel the room was worth the price", "I don't think it is value for money".
            clause_start = max([b + 1 for b in range(first) if tokens[b] == BOUNDARY], default=0)
            negators_before += [
                j for j in range(clause_start, max(clause_start, first - 1))
                if tokens[j] == "not" and j + 1 < first and tokens[j + 1] in RAISING_VERBS and j not in claimed
            ]
            if kind == "idiom" and polarity != 0 and negators_before and not phrase.startswith(_SELF_NEGATED):
                # "not worth it", "never solved the problem"
                final_polarity = -polarity
                final_strength = STRONG if polarity > 0 else WEAK
                claimed.update(negators_before)
            elif kind == "lukewarm" and negators_before:
                # "not as described", "not as expected"
                final_polarity, final_strength = -1, STRONG
                claimed.update(negators_before)

            claimed.update(covered)
            if kind == "absence":
                absence_ends.add(covered[-1])
            if kind != "filler":
                score.opinions.append(Opinion(first, final_polarity, final_strength, kind, phrase))

    negation_active = False
    negation_budget = 0
    negator_index = -1
    i = 0
    while i < len(tokens):
        if i in claimed:
            negation_active = False
            i += 1
            continue
        token = tokens[i]

        if token == BOUNDARY:
            negation_active = False
            i += 1
            continue

        # "no window or any fresh air": the absence carries across "or".
        if token in {"or", "nor"} and i - 1 in absence_ends:
            negation_active, negation_budget, negator_index = True, DEFAULT_NEGATOR_SCOPE, i - 1
            i += 1
            continue

        # A common typo: "quiet noisy", "quiet small" mean "quite noisy/small".
        if token == "quiet" and i + 1 < len(tokens) and (tokens[i + 1] in DESCRIPTIVE or (lexicon_polarity(tokens[i + 1]) or (0, 0))[0] < 0):
            i += 1
            continue

        # "far from clean" negates; "far from the centre" is a location complaint.
        if token == "far" and i + 1 < len(tokens) and tokens[i + 1] == "from":
            ahead = tokens[i + 2:i + 5]
            if any((lexicon_polarity(word) or (0, 0))[0] != 0 for word in ahead):
                negation_active, negation_budget, negator_index = True, 2, i
                i += 2
                continue

        if token in NEGATORS:
            negation_active = True
            negation_budget = NEGATOR_SCOPE.get(token, DEFAULT_NEGATOR_SCOPE)
            negator_index = i
            i += 1
            continue

        if token in {"lack", "lacks", "lacked", "lacking"}:
            # A complaint by itself ("lack of cleanliness") that also negates the
            # praise after it ("lack of fresh fruit").
            score.opinions.append(Opinion(i, -1, STRONG, "word", token))
            negation_active, negation_budget, negator_index = True, DEFAULT_NEGATOR_SCOPE, i
            i += 1
            continue

        if negation_active and token in {"think", "feel", "believe", "find", "say", "consider"}:
            # "I did not feel the room was worth the price": the negation covers the clause.
            negation_budget = 6

        if negation_active and token in {"so", "such"} and tokens[negator_index] == "never":
            # "never been so disappointed", "never seen such a dirty room" are emphatic.
            negation_active = False

        negated = negation_active

        if token == "too":
            nxt_index = i + 1
            while nxt_index < len(tokens) and nxt_index < i + 3 and tokens[nxt_index] in {"much", "many", "very", "abit"}:
                nxt_index += 1
            nxt = tokens[nxt_index] if nxt_index < len(tokens) else ""
            lexical = lexicon_polarity(nxt) if nxt else None
            if negated and lexical and lexical[0] > 0:
                # "not too much good service" is negated praise.
                score.opinions.append(Opinion(nxt_index, -1, STRONG, "negated", f"not too {nxt}"))
                claimed.add(nxt_index)
                negation_active = False
                i = nxt_index + 1
                continue
            if nxt in DESCRIPTIVE or (lexical and lexical[0] < 0) or tokens[i + 1:i + 2] in (["much"], ["many"]):
                if negated:
                    # "not too far", "not too expensive"
                    score.opinions.append(Opinion(i, 1, WEAK, "negated", f"not too {nxt}".strip()))
                    negation_active = False
                else:
                    score.opinions.append(Opinion(i, -1, STRONG, "excess", f"too {nxt}".strip()))
                if nxt:
                    claimed.add(nxt_index)
                i = nxt_index + 1
                continue
            i += 1
            continue

        lexical = lexicon_polarity(token)
        if token in {"like", "likes"} and i > 0 and tokens[i - 1] in LIKE_SUBJECTS:
            lexical = (1, STRONG)

        if lexical is None:
            # Diminisher + descriptive word: "a bit far", "slightly dated".
            if token in DIMINISHERS and i + 1 < len(tokens) and tokens[i + 1] in DESCRIPTIVE and lexicon_polarity(tokens[i + 1]) in (None, (-1, WEAK), (0, WEAK)) and not negated:
                score.opinions.append(Opinion(i + 1, -1, WEAK, "degree", f"{token} {tokens[i + 1]}"))
                claimed.add(i + 1)
                i += 2
                continue
            if negation_active and token not in TRANSPARENT:
                negation_budget -= 1
                if negation_budget <= 0:
                    negation_active = False
            i += 1
            continue

        polarity, strength = lexical
        if negated and token in {"luxury", "luxurious", "superior", "central"} and not _is_contextual_praise(tokens, i):
            # "not a luxury hotel" names a category; it is not a complaint.
            negation_active = False
            i += 1
            continue
        if not negated:
            if token in CONTEXTUAL_LUKEWARM:
                prev, nxt = _neighbours(tokens, i)
                if nxt in ROOM_TYPE_FOLLOWERS:
                    # "we booked a standard room" names a room type.
                    i += 1
                    continue
                if token == "basic" and prev in {"very", "quite", "rather", "pretty", "really", "extremely", "so", "fairly"}:
                    # "facilities are quite basic" is a mild complaint.
                    score.opinions.append(Opinion(i, -1, WEAK, "degree", f"{prev} {token}"))
                    i += 1
                    continue
            if token in CONTEXTUAL_NEGATIVE and not _is_contextual_complaint(tokens, i):
                i += 1
                continue
            if token in CONTEXTUAL_POSITIVE and not _is_contextual_praise(tokens, i):
                if token == "cheap":
                    # "a cheap mattress", "cheap furniture"
                    score.opinions.append(Opinion(i, -1, WEAK, "word", "cheap (quality)"))
                i += 1
                continue

        if negated and polarity != 0:
            # Negated praise is a complaint; negated criticism is mild praise.
            if polarity > 0:
                score.opinions.append(Opinion(i, -1, STRONG, "negated", f"{tokens[negator_index]} {token}"))
            else:
                score.opinions.append(Opinion(i, 1, WEAK, "negated", f"{tokens[negator_index]} {token}"))
            # Coordinated words share the negation: "not clean or tidy".
            if i + 2 < len(tokens) and tokens[i + 1] in {"and", "or", "nor"} and lexicon_polarity(tokens[i + 2]):
                negation_budget = 1
            else:
                negation_active = False
        elif negated and token == "acceptable":
            score.opinions.append(Opinion(i, -1, STRONG, "negated", f"not {token}"))
            negation_active = False
        else:
            if negated:
                negation_active = False
            score.opinions.append(Opinion(i, polarity, strength, "lukewarm" if polarity == 0 else "word", token))
        i += 1

    _mark_hypothetical_praise(score)
    score.opinions.sort(key=lambda o: o.index)
    return score


def _mark_hypothetical_praise(score: OpinionScore) -> None:
    """Praise inside a suggestion's subject is hypothetical.

    In "Good Wi-Fi would help a lot" the word "good" describes Wi-Fi the guest
    wishes for, not Wi-Fi they received, so it is not counted as praise.
    """
    suggestions = [o.index for o in score.opinions if o.kind == "suggestion"]
    if not suggestions:
        return
    boundaries = [i for i, token in enumerate(score.tokens) if token == BOUNDARY]
    for opinion in score.opinions:
        if opinion.polarity > 0 and opinion.kind == "word":
            # Before the request ("good Wi-Fi | would help") or after it
            # ("I wish | the bed was more comfortable"), within the same phrase.
            before = any(0 < s - opinion.index <= 3 for s in suggestions)
            after = any(opinion.index > s and not any(s < b < opinion.index for b in boundaries) for s in suggestions)
            if before or after:
                opinion.kind = "hypothetical"


__all__ = ["Opinion", "OpinionScore", "score_opinion", "normalize_for_lexicon", "lexicon_polarity", "BOUNDARY", "STRONG", "WEAK"]
