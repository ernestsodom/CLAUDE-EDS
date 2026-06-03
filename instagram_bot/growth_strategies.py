"""Hashtag databases, best posting times, engagement strategies, and CTA templates."""

from dataclasses import dataclass

# ── Hashtag sets by niche ─────────────────────────────────────────────────────
# Each set: core (high-reach) + mid (medium) + niche (low-competition, higher engagement)

HASHTAG_SETS: dict[str, dict[str, list[str]]] = {
    "fashion": {
        "core": ["#fashion", "#style", "#ootd", "#fashionista", "#outfit", "#fashionblogger",
                 "#instafashion", "#trendy", "#lookbook", "#fashionweek"],
        "mid":  ["#streetstyle", "#outfitoftheday", "#womensfashion", "#styleblogger",
                 "#fashioninspo", "#casualstyle", "#minimalistfashion", "#sustainablefashion",
                 "#vintagefashion", "#luxuryfashion"],
        "niche": ["#capsulewardrobe", "#slowfashion", "#outfitinspiration", "#styleinspo",
                  "#whatiwore", "#mystyle", "#fashiondaily", "#fashionedit", "#closetgoals",
                  "#wardrobegoals"],
    },
    "food": {
        "core": ["#food", "#foodie", "#foodphotography", "#instafood", "#yummy", "#delicious",
                 "#foodstagram", "#eater", "#foodlover", "#foodporn"],
        "mid":  ["#homecooking", "#recipe", "#healthyfood", "#veganfood", "#foodblogger",
                 "#cooking", "#cheflife", "#mealprep", "#foodart", "#foodblog"],
        "niche": ["#foodinspo", "#whatsfordinner", "#cookingathome", "#foodielife",
                  "#comfortfood", "#plantbased", "#cleaneating", "#foodgram", "#homemade",
                  "#recipeshare"],
    },
    "fitness": {
        "core": ["#fitness", "#gym", "#workout", "#fit", "#motivation", "#health",
                 "#bodybuilding", "#training", "#exercise", "#fitnessmotivation"],
        "mid":  ["#fitfam", "#gymlife", "#healthylifestyle", "#personaltrainer", "#crossfit",
                 "#weightlifting", "#cardio", "#yogalife", "#running", "#fitspo"],
        "niche": ["#fitnessinspiration", "#gymrat", "#workoutmotivation", "#fitnessjourney",
                  "#strengthtraining", "#fitgoals", "#eatclean", "#fitlife", "#gains",
                  "#bodygoals"],
    },
    "tech": {
        "core": ["#tech", "#technology", "#innovation", "#startup", "#ai", "#coding",
                 "#programming", "#developer", "#software", "#digital"],
        "mid":  ["#techindustry", "#machinelearning", "#artificialintelligence", "#webdev",
                 "#devlife", "#techtips", "#gadgets", "#techstartup", "#uxdesign", "#appdev"],
        "niche": ["#buildingpublicly", "#indiehacker", "#techfounder", "#solopreneur",
                  "#sideproject", "#techcommunity", "#coderlife", "#100daysofcode",
                  "#techtrends", "#futurism"],
    },
    "lifestyle": {
        "core": ["#lifestyle", "#life", "#happy", "#love", "#instagood", "#photooftheday",
                 "#beautiful", "#picoftheday", "#follow", "#instadaily"],
        "mid":  ["#lifestyleblogger", "#morningroutine", "#selfcare", "#mindfulness",
                 "#positivevibes", "#gratitude", "#dailyroutine", "#wellbeing", "#slowliving",
                 "#intentionalliving"],
        "niche": ["#authenticliving", "#simplicity", "#lifestylecontent", "#dailylife",
                  "#lifestylegoals", "#livingmybestlife", "#lifeisbeautiful", "#contentcreator",
                  "#creativelife", "#dayinmylife"],
    },
    "beauty": {
        "core": ["#beauty", "#makeup", "#skincare", "#beautytips", "#glam", "#cosmetics",
                 "#makeuplover", "#beautyblogger", "#skincareroutine", "#beautycare"],
        "mid":  ["#makeuptutorial", "#glowup", "#naturalmakeup", "#skincaregoals",
                 "#beautyinsider", "#makeuplife", "#selfcare", "#beautyproducts",
                 "#makeupoftheday", "#grwm"],
        "niche": ["#skintok", "#glassskin", "#cleanbeauty", "#crueltyfreemakeup",
                  "#koreanbeauty", "#kbeauty", "#beautyedit", "#hyperskin", "#beautyreel",
                  "#makeupjunkie"],
    },
    "travel": {
        "core": ["#travel", "#travelgram", "#wanderlust", "#explore", "#adventure",
                 "#travelphotography", "#instatravel", "#vacation", "#trip", "#backpacking"],
        "mid":  ["#travelblogger", "#travellife", "#traveler", "#seetheworld", "#travelphoto",
                 "#traveling", "#travelholic", "#traveltheworld", "#globetrotter",
                 "#traveladdict"],
        "niche": ["#solotravel", "#luxurytravel", "#budgettravel", "#travelinspiration",
                  "#hiddengem", "#offthebeatenpath", "#sustainabletravel", "#digitalnomad",
                  "#workanywhere", "#travelcouple"],
    },
    "business": {
        "core": ["#business", "#entrepreneur", "#success", "#marketing", "#branding",
                 "#smallbusiness", "#businessowner", "#entrepreneurship", "#hustle", "#mindset"],
        "mid":  ["#businesstips", "#ceo", "#startup", "#growth", "#socialmediamarketing",
                 "#digitalmarketing", "#contentmarketing", "#personalbrand", "#leadershipskills",
                 "#businessmindset"],
        "niche": ["#fempreneur", "#bossbabe", "#womeninbusiness", "#buildinginpublic",
                  "#b2b", "#ecommerce", "#dropshipping", "#passiveincome", "#financialfreedom",
                  "#growthhacking"],
    },
    "health": {
        "core": ["#health", "#wellness", "#healthy", "#mentalhealth", "#nutrition",
                 "#selfcare", "#wellbeing", "#mindfulness", "#meditation", "#yoga"],
        "mid":  ["#healthyliving", "#healthylifestyle", "#holistichealth", "#plantbased",
                 "#vegan", "#wholesome", "#bodypositive", "#mindbodysoul", "#wellnessjourney",
                 "#nutritionadvice"],
        "niche": ["#functionalmedicine", "#guthealth", "#hormonehealth", "#intuitiveating",
                  "#antianxiety", "#sleephealth", "#biohacking", "#longevity",
                  "#healthcoach", "#mindfuleating"],
    },
    "pets": {
        "core": ["#pets", "#dogs", "#cats", "#dog", "#cat", "#animals", "#dogstagram",
                 "#catstagram", "#petstagram", "#animallovers"],
        "mid":  ["#doglover", "#catlover", "#puppylove", "#kittensofinstagram",
                 "#dogsofinstagram", "#catsofinstagram", "#petlife", "#animalphotography",
                 "#furryfriends", "#petlovers"],
        "niche": ["#rescuedog", "#adoptdontshop", "#petparent", "#dogmom", "#catmom",
                  "#petcare", "#puppyoftheday", "#kittycat", "#zoomies", "#petcommunity"],
    },
}


def get_hashtags(niche: str, strategy: str = "mixed", count: int = 30) -> list[str]:
    """
    Build a hashtag set using a layered strategy.
    strategy: 'mixed' (recommended), 'core', 'niche'
    """
    niche = niche.lower()
    if niche not in HASHTAG_SETS:
        niche = "lifestyle"

    sets = HASHTAG_SETS[niche]

    if strategy == "core":
        return sets["core"][:count]
    if strategy == "niche":
        return (sets["niche"] + sets["mid"])[:count]

    # Mixed: blend all three tiers
    mixed = []
    sources = [sets["core"], sets["mid"], sets["niche"]]
    i = 0
    while len(mixed) < count:
        source = sources[i % 3]
        idx = i // 3
        if idx < len(source):
            mixed.append(source[idx])
        i += 1
        if all(i // 3 >= len(s) for s in sources):
            break

    return mixed[:count]


# ── Best posting times by industry ────────────────────────────────────────────

BEST_TIMES: dict[str, list[dict]] = {
    "fashion":   [{"day": "Monday", "hour": 11}, {"day": "Wednesday", "hour": 14},
                  {"day": "Friday", "hour": 12}, {"day": "Saturday", "hour": 10}],
    "food":      [{"day": "Tuesday", "hour": 12}, {"day": "Thursday", "hour": 18},
                  {"day": "Friday", "hour": 19}, {"day": "Sunday", "hour": 11}],
    "fitness":   [{"day": "Monday", "hour": 6}, {"day": "Wednesday", "hour": 7},
                  {"day": "Friday", "hour": 6}, {"day": "Saturday", "hour": 9}],
    "tech":      [{"day": "Tuesday", "hour": 10}, {"day": "Wednesday", "hour": 11},
                  {"day": "Thursday", "hour": 13}, {"day": "Friday", "hour": 10}],
    "lifestyle": [{"day": "Monday", "hour": 9}, {"day": "Wednesday", "hour": 12},
                  {"day": "Friday", "hour": 15}, {"day": "Sunday", "hour": 10}],
    "beauty":    [{"day": "Tuesday", "hour": 11}, {"day": "Thursday", "hour": 14},
                  {"day": "Saturday", "hour": 12}, {"day": "Sunday", "hour": 13}],
    "travel":    [{"day": "Wednesday", "hour": 9}, {"day": "Friday", "hour": 12},
                  {"day": "Saturday", "hour": 8}, {"day": "Sunday", "hour": 9}],
    "business":  [{"day": "Tuesday", "hour": 9}, {"day": "Wednesday", "hour": 10},
                  {"day": "Thursday", "hour": 11}, {"day": "Friday", "hour": 9}],
    "health":    [{"day": "Monday", "hour": 8}, {"day": "Wednesday", "hour": 9},
                  {"day": "Friday", "hour": 7}, {"day": "Saturday", "hour": 10}],
    "pets":      [{"day": "Tuesday", "hour": 10}, {"day": "Thursday", "hour": 16},
                  {"day": "Saturday", "hour": 11}, {"day": "Sunday", "hour": 14}],
}


def get_best_times(niche: str) -> list[dict]:
    return BEST_TIMES.get(niche.lower(), BEST_TIMES["lifestyle"])


# ── CTA templates ─────────────────────────────────────────────────────────────

CTA_TEMPLATES = {
    "engagement": [
        "¿Cuál es tu opinión? Cuéntanos en los comentarios 👇",
        "Doble tap si estás de acuerdo ❤️",
        "Etiqueta a un amigo que necesita ver esto 👇",
        "Guarda este post para cuando lo necesites 📌",
        "Comparte si te identificas 🔄",
    ],
    "follow": [
        "Síguenos para más contenido como este 🔔",
        "Activa las notificaciones para no perderte nada 🔔",
        "¿Ya nos sigues? ¡Bienvenido a la familia! 🙌",
        "Únete a nuestra comunidad — síguenos para más 👆",
    ],
    "conversion": [
        "Link en bio para más información 🔗",
        "DM para consultas personalizadas 📩",
        "Disponible ahora — link en bio 🛒",
        "Escríbenos 'INFO' en los comentarios 📬",
    ],
    "community": [
        "¿Con qué te quedas? Opción A o B — comenta 👇",
        "Cuéntanos: ¿lo has probado antes? 🤔",
        "Comparte tu experiencia en los comentarios 💬",
        "¿Cuál es tu favorito? 1, 2 o 3 👇",
    ],
}


def get_cta(category: str = "engagement") -> str:
    import random
    options = CTA_TEMPLATES.get(category, CTA_TEMPLATES["engagement"])
    return random.choice(options)


# ── Engagement rate calculator ────────────────────────────────────────────────

@dataclass
class EngagementMetrics:
    likes: int
    comments: int
    saves: int
    shares: int
    reach: int

    @property
    def rate(self) -> float:
        if self.reach == 0:
            return 0.0
        total = self.likes + self.comments + self.saves + self.shares
        return round((total / self.reach) * 100, 2)

    @property
    def rating(self) -> str:
        r = self.rate
        if r >= 6:   return "Excelente"
        if r >= 3:   return "Bueno"
        if r >= 1:   return "Promedio"
        return "Bajo"


def all_niches() -> list[str]:
    return list(HASHTAG_SETS.keys())
