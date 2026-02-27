{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://al-noskha.app/schemas/screenplay-classifier.json",
  "title": "مصنف السيناريو العربي — النسخة",
  "description": "Arabic Screenplay Classifier — Al-Noskha Project — Production-Ready JSON Schema",

  "definitions": {

    "ProjectType": {
      "type": "string",
      "enum": [
        "feature_film",
        "short_film",
        "tv_series",
        "tv_movie",
        "mini_series",
        "web_series",
        "theater_play",
        "radio_drama",
        "documentary",
        "animation"
      ],
      "enumLabels": {
        "feature_film": "فيلم روائي طويل",
        "short_film": "فيلم قصير",
        "tv_series": "مسلسل تلفزيوني",
        "tv_movie": "فيلم تلفزيوني",
        "mini_series": "مسلسل قصير",
        "web_series": "مسلسل ويب",
        "theater_play": "مسرحية",
        "radio_drama": "دراما إذاعية",
        "documentary": "سيناريو وثائقي",
        "animation": "رسوم متحركة"
      }
    },

    "Genre": {
      "type": "string",
      "enum": [
        "drama", "comedy", "tragedy", "action", "thriller",
        "horror", "romance", "mystery", "crime", "historical",
        "biographical", "fantasy", "sci_fi", "war", "political",
        "social", "religious", "musical", "satirical",
        "comedy_drama", "romantic_comedy", "action_thriller",
        "crime_thriller", "historical_drama", "social_drama",
        "dark_comedy", "psych_thriller", "folk_tale"
      ],
      "enumLabels": {
        "drama": "دراما",
        "comedy": "كوميديا",
        "tragedy": "تراجيديا",
        "action": "أكشن",
        "thriller": "إثارة",
        "horror": "رعب",
        "romance": "رومانسية",
        "mystery": "غموض",
        "crime": "جريمة",
        "historical": "تاريخي",
        "biographical": "سيرة ذاتية",
        "fantasy": "فانتازيا",
        "sci_fi": "خيال علمي",
        "war": "حرب",
        "political": "سياسي",
        "social": "اجتماعي",
        "religious": "ديني",
        "musical": "موسيقي / استعراضي",
        "satirical": "ساخر",
        "comedy_drama": "كوميدراما",
        "romantic_comedy": "كوميديا رومانسية",
        "action_thriller": "أكشن إثارة",
        "crime_thriller": "جريمة وإثارة",
        "historical_drama": "دراما تاريخية",
        "social_drama": "دراما اجتماعية",
        "dark_comedy": "كوميديا سوداء",
        "psych_thriller": "إثارة نفسية",
        "folk_tale": "حكاية شعبية"
      }
    },

    "TimePeriod": {
      "type": "string",
      "enum": [
        "ancient", "islamic_golden", "medieval", "ottoman",
        "colonial", "early_modern", "mid_century", "contemporary",
        "near_future", "far_future", "unspecified", "multi_era"
      ],
      "enumLabels": {
        "ancient": "قديم (قبل الإسلام)",
        "islamic_golden": "العصر الإسلامي الذهبي",
        "medieval": "العصور الوسطى",
        "ottoman": "العصر العثماني",
        "colonial": "فترة الاستعمار",
        "early_modern": "أوائل العصر الحديث (1900-1950)",
        "mid_century": "منتصف القرن (1950-1980)",
        "contemporary": "معاصر (1980-الآن)",
        "near_future": "مستقبل قريب",
        "far_future": "مستقبل بعيد",
        "unspecified": "غير محدد",
        "multi_era": "متعدد الحقب"
      }
    },

    "ArabicDialect": {
      "type": "string",
      "enum": [
        "msa", "egyptian", "levantine", "syrian", "lebanese",
        "palestinian", "jordanian", "iraqi", "gulf", "saudi",
        "emirati", "kuwaiti", "moroccan", "tunisian", "algerian",
        "libyan", "sudanese", "yemeni", "mixed"
      ],
      "enumLabels": {
        "msa": "الفصحى",
        "egyptian": "مصري",
        "levantine": "شامي",
        "syrian": "سوري",
        "lebanese": "لبناني",
        "palestinian": "فلسطيني",
        "jordanian": "أردني",
        "iraqi": "عراقي",
        "gulf": "خليجي",
        "saudi": "سعودي",
        "emirati": "إماراتي",
        "kuwaiti": "كويتي",
        "moroccan": "مغربي",
        "tunisian": "تونسي",
        "algerian": "جزائري",
        "libyan": "ليبي",
        "sudanese": "سوداني",
        "yemeni": "يمني",
        "mixed": "مختلطة"
      }
    },

    "ProjectStatus": {
      "type": "string",
      "enum": [
        "concept", "outline", "treatment", "first_draft",
        "revision", "polish", "final_draft", "pre_production",
        "in_production", "completed"
      ],
      "enumLabels": {
        "concept": "فكرة أولية",
        "outline": "معالجة",
        "treatment": "تريتمنت",
        "first_draft": "مسودة أولى",
        "revision": "مراجعة",
        "polish": "تنقيح نهائي",
        "final_draft": "مسودة نهائية",
        "pre_production": "ما قبل الإنتاج",
        "in_production": "قيد التصوير",
        "completed": "مكتمل"
      }
    },

    "AudienceRating": {
      "type": "string",
      "enum": ["general", "pg", "teen", "mature", "adult"],
      "enumLabels": {
        "general": "عام — مناسب للجميع",
        "pg": "إرشاد عائلي",
        "teen": "مراهقين +13",
        "mature": "ناضجين +16",
        "adult": "كبار فقط +18"
      }
    },

    "ScreenplayElement": {
      "type": "string",
      "enum": [
        "scene_heading", "action", "character_name", "dialogue",
        "parenthetical", "transition", "shot", "dual_dialogue",
        "title_card", "opening_credits", "closing_credits",
        "montage_header", "flashback_header", "dream_header",
        "intercut", "chyron", "lyrics", "note", "page_break",
        "section_header", "cold_open"
      ]
    },

    "SceneHeadingPattern": {
      "type": "string",
      "enum": [
        "egyptian_classic", "modern_arabic", "western_adapted",
        "abbreviated", "numbered"
      ],
      "enumLabels": {
        "egyptian_classic": "مشهد 1 — داخلي — شقة أحمد — نهار",
        "modern_arabic": "داخلي. شقة أحمد — نهار",
        "western_adapted": "داخلي — شقة أحمد — نهار",
        "abbreviated": "د. شقة أحمد — ن",
        "numbered": "1. داخلي — شقة أحمد — نهار"
      }
    },

    "TransitionType": {
      "type": "string",
      "enum": [
        "cut_to", "fade_in", "fade_out", "dissolve", "wipe",
        "match_cut", "jump_cut", "smash_cut", "fade_to_black",
        "fade_to_white", "iris_in", "iris_out", "time_cut", "continuous"
      ]
    },

    "SceneLocation": {
      "type": "string",
      "enum": ["interior", "exterior", "int_ext", "ext_int"],
      "enumLabels": {
        "interior": "داخلي",
        "exterior": "خارجي",
        "int_ext": "داخلي / خارجي",
        "ext_int": "خارجي / داخلي"
      }
    },

    "SceneTime": {
      "type": "string",
      "enum": [
        "day", "night", "dawn", "sunrise", "morning", "afternoon",
        "sunset", "dusk", "evening", "late_night", "continuous",
        "moments_later", "same_time", "unspecified"
      ],
      "enumLabels": {
        "day": "نهار",
        "night": "ليل",
        "dawn": "فجر",
        "sunrise": "شروق",
        "morning": "صباح",
        "afternoon": "عصر",
        "sunset": "غروب",
        "dusk": "مغرب",
        "evening": "مساء",
        "late_night": "آخر الليل",
        "continuous": "متصل",
        "moments_later": "بعد لحظات",
        "same_time": "نفس الوقت",
        "unspecified": "غير محدد"
      }
    },

    "SceneDramaticType": {
      "type": "string",
      "enum": [
        "dialogue", "action", "montage", "flashback", "flash_forward",
        "dream", "nightmare", "fantasy", "parallel", "chase", "fight",
        "love_scene", "revelation", "confrontation", "ceremony",
        "phone_call", "voiceover", "silent", "establishing",
        "transition", "climax", "resolution"
      ]
    },

    "SceneMood": {
      "type": "string",
      "enum": [
        "tense", "joyful", "melancholic", "romantic", "suspenseful",
        "humorous", "terrifying", "nostalgic", "mysterious", "peaceful",
        "chaotic", "dramatic", "euphoric", "somber", "hopeful",
        "desperate", "ironic", "neutral"
      ]
    },

    "SceneImportance": {
      "type": "string",
      "enum": ["critical", "high", "medium", "low", "transitional"],
      "enumLabels": {
        "critical": "حرج — نقطة تحول",
        "high": "عالي",
        "medium": "متوسط",
        "low": "منخفض",
        "transitional": "انتقالي"
      }
    },

    "CharacterRole": {
      "type": "string",
      "enum": [
        "protagonist", "antagonist", "deuteragonist", "love_interest",
        "mentor", "sidekick", "ally", "rival", "comic_relief",
        "guardian", "trickster", "herald", "shapeshifter",
        "threshold_guardian", "narrator"
      ]
    },

    "CharacterSize": {
      "type": "string",
      "enum": [
        "lead", "supporting", "recurring", "guest", "cameo",
        "featured_extra", "extra", "voiceover_only"
      ]
    },

    "CharacterArc": {
      "type": "string",
      "enum": [
        "positive_change", "negative_change", "flat", "corruption",
        "redemption", "disillusionment", "growth", "tragic", "circular"
      ]
    },

    "CharacterGender": {
      "type": "string",
      "enum": ["male", "female", "unspecified"]
    },

    "AgeGroup": {
      "type": "string",
      "enum": [
        "child", "teenager", "young_adult", "adult",
        "middle_aged", "elderly", "unspecified"
      ]
    },

    "RelationshipType": {
      "type": "string",
      "enum": [
        "parent_child", "siblings", "spouses", "extended_family", "in_laws",
        "lovers", "ex_partners", "unrequited", "secret_affair",
        "friends", "best_friends", "neighbors", "acquaintances",
        "colleagues", "boss_employee", "teacher_student", "business_partners",
        "enemies", "rivals", "nemesis"
      ]
    },

    "DialogueType": {
      "type": "string",
      "enum": [
        "direct", "monologue", "inner_monologue", "voiceover",
        "off_screen", "phone", "whisper", "shout", "singing",
        "prayer", "narration", "pre_lap", "subtitle", "text_message",
        "letter_read", "news_broadcast", "radio", "tv_screen",
        "intercom", "flashback_vo"
      ]
    },

    "LanguageRegister": {
      "type": "string",
      "enum": [
        "formal_msa", "literary", "educated_dialect", "colloquial",
        "street", "slang", "archaic", "religious", "technical",
        "poetic", "mixed", "child_speech", "foreign_accent"
      ]
    },

    "DialogueFunction": {
      "type": "string",
      "enum": [
        "exposition", "conflict", "revelation", "persuasion",
        "deception", "humor", "foreshadowing", "subtext",
        "emotional_release", "bonding", "negotiation", "interrogation",
        "confession", "declaration", "farewell", "greeting",
        "planning", "reminiscence", "threat", "plea"
      ]
    },

    "ScreenplayProject": {
      "type": "object",
      "required": [
        "id", "title", "logline", "projectType", "genres",
        "primaryDialect", "timePeriod", "status", "audienceRating",
        "totalScenes", "writers", "country", "themes", "tags",
        "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string", "description": "معرف فريد" },
        "title": { "type": "string", "description": "عنوان العمل بالعربية" },
        "titleEn": { "type": ["string", "null"], "description": "العنوان بالإنجليزية" },
        "logline": { "type": "string", "description": "اللوجلاين — جملة واحدة تلخص العمل", "maxLength": 300 },
        "synopsis": { "type": ["string", "null"], "description": "ملخص مطول" },
        "projectType": { "$ref": "#/definitions/ProjectType" },
        "genres": {
          "type": "array",
          "items": { "$ref": "#/definitions/Genre" },
          "minItems": 1,
          "description": "النوع الدرامي — يمكن أكثر من نوع"
        },
        "primaryDialect": { "$ref": "#/definitions/ArabicDialect" },
        "additionalDialects": {
          "type": "array",
          "items": { "$ref": "#/definitions/ArabicDialect" },
          "default": []
        },
        "timePeriod": { "$ref": "#/definitions/TimePeriod" },
        "status": { "$ref": "#/definitions/ProjectStatus" },
        "audienceRating": { "$ref": "#/definitions/AudienceRating" },
        "totalScenes": { "type": "integer", "minimum": 0 },
        "estimatedDuration": { "type": ["integer", "null"], "description": "المدة بالدقائق" },
        "pageCount": { "type": ["integer", "null"] },
        "seasonNumber": { "type": ["integer", "null"], "description": "للمسلسلات" },
        "episodeNumber": { "type": ["integer", "null"], "description": "للمسلسلات" },
        "episodeTitle": { "type": ["string", "null"], "description": "للمسلسلات" },
        "writers": { "type": "array", "items": { "type": "string" }, "minItems": 1 },
        "director": { "type": ["string", "null"] },
        "producer": { "type": ["string", "null"] },
        "productionCompany": { "type": ["string", "null"] },
        "country": { "type": "string", "default": "مصر" },
        "year": { "type": ["integer", "null"] },
        "themes": { "type": "array", "items": { "type": "string" } },
        "tags": { "type": "array", "items": { "type": "string" } },
        "notes": { "type": ["string", "null"] },
        "scenes": {
          "type": "array",
          "items": { "$ref": "#/definitions/Scene" },
          "default": []
        },
        "characters": {
          "type": "array",
          "items": { "$ref": "#/definitions/Character" },
          "default": []
        },
        "relationships": {
          "type": "array",
          "items": { "$ref": "#/definitions/CharacterRelationship" },
          "default": []
        },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },

    "Scene": {
      "type": "object",
      "required": [
        "id", "projectId", "sceneNumber", "slugline", "location",
        "time", "settingName", "dramaticType", "mood", "importance",
        "headingPattern", "actionText", "orderIndex", "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string" },
        "projectId": { "type": "string" },
        "sceneNumber": { "type": "integer", "minimum": 1 },
        "slugline": { "type": "string", "description": "عنوان المشهد الكامل" },
        "location": { "$ref": "#/definitions/SceneLocation" },
        "time": { "$ref": "#/definitions/SceneTime" },
        "settingName": { "type": "string", "description": "اسم المكان" },
        "settingDescription": { "type": ["string", "null"] },
        "dramaticType": { "$ref": "#/definitions/SceneDramaticType" },
        "mood": { "$ref": "#/definitions/SceneMood" },
        "importance": { "$ref": "#/definitions/SceneImportance" },
        "headingPattern": { "$ref": "#/definitions/SceneHeadingPattern" },
        "transitionIn": { "$ref": "#/definitions/TransitionType" },
        "transitionOut": { "$ref": "#/definitions/TransitionType" },
        "pageStart": { "type": ["number", "null"] },
        "pageEnd": { "type": ["number", "null"] },
        "estimatedDuration": { "type": ["integer", "null"], "description": "بالثواني" },
        "wordCount": { "type": ["integer", "null"] },
        "actionText": { "type": "string", "description": "النص الوصفي الكامل" },
        "characterIds": {
          "type": "array",
          "items": { "type": "string" },
          "default": []
        },
        "plotPoints": {
          "type": "array",
          "items": { "type": "string" },
          "default": []
        },
        "subplotIds": {
          "type": "array",
          "items": { "type": "string" },
          "default": []
        },
        "props": { "type": "array", "items": { "type": "string" }, "default": [] },
        "costumes": { "type": "array", "items": { "type": "string" }, "default": [] },
        "specialEffects": { "type": "array", "items": { "type": "string" }, "default": [] },
        "music": { "type": "array", "items": { "type": "string" }, "default": [] },
        "writerNotes": { "type": ["string", "null"] },
        "directorNotes": { "type": ["string", "null"] },
        "elements": {
          "type": "array",
          "items": { "$ref": "#/definitions/ScreenplayElementBlock" },
          "default": []
        },
        "dialogueLines": {
          "type": "array",
          "items": { "$ref": "#/definitions/DialogueLine" },
          "default": []
        },
        "orderIndex": { "type": "integer" },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },

    "Character": {
      "type": "object",
      "required": [
        "id", "projectId", "name", "role", "size", "arc",
        "gender", "ageGroup", "dialect", "register", "tags",
        "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string" },
        "projectId": { "type": "string" },
        "name": { "type": "string", "description": "الاسم بالعربية" },
        "nameEn": { "type": ["string", "null"] },
        "nickname": { "type": ["string", "null"], "description": "اللقب / الكنية" },
        "role": { "$ref": "#/definitions/CharacterRole" },
        "size": { "$ref": "#/definitions/CharacterSize" },
        "arc": { "$ref": "#/definitions/CharacterArc" },
        "gender": { "$ref": "#/definitions/CharacterGender" },
        "ageGroup": { "$ref": "#/definitions/AgeGroup" },
        "specificAge": { "type": ["integer", "null"], "minimum": 0 },
        "dialect": { "$ref": "#/definitions/ArabicDialect" },
        "register": { "$ref": "#/definitions/LanguageRegister" },
        "speechPatterns": { "type": ["string", "null"], "description": "أنماط كلام مميزة" },
        "catchphrases": {
          "type": "array",
          "items": { "type": "string" },
          "default": [],
          "description": "عبارات مميزة"
        },
        "physicalDescription": { "type": ["string", "null"] },
        "psychologicalProfile": { "type": ["string", "null"] },
        "backstory": { "type": ["string", "null"] },
        "motivation": { "type": ["string", "null"], "description": "الدافع الرئيسي" },
        "flaw": { "type": ["string", "null"], "description": "العيب الدرامي" },
        "strength": { "type": ["string", "null"], "description": "نقطة القوة" },
        "occupation": { "type": ["string", "null"], "description": "المهنة" },
        "socialClass": { "type": ["string", "null"] },
        "education": { "type": ["string", "null"] },
        "religion": { "type": ["string", "null"] },
        "origin": { "type": ["string", "null"], "description": "الأصل / البلد" },
        "sceneCount": { "type": "integer", "default": 0 },
        "dialogueCount": { "type": "integer", "default": 0 },
        "firstAppearance": { "type": ["integer", "null"] },
        "lastAppearance": { "type": ["integer", "null"] },
        "notes": { "type": ["string", "null"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },

    "CharacterRelationship": {
      "type": "object",
      "required": [
        "id", "projectId", "characterAId", "characterBId",
        "type", "intensity", "isSecret"
      ],
      "properties": {
        "id": { "type": "string" },
        "projectId": { "type": "string" },
        "characterAId": { "type": "string" },
        "characterBId": { "type": "string" },
        "type": { "$ref": "#/definitions/RelationshipType" },
        "description": { "type": ["string", "null"] },
        "dynamicDescription": { "type": ["string", "null"], "description": "كيف تتطور العلاقة" },
        "intensity": { "type": "integer", "minimum": 1, "maximum": 5 },
        "isSecret": { "type": "boolean", "default": false },
        "startsAtScene": { "type": ["integer", "null"] },
        "endsAtScene": { "type": ["integer", "null"] },
        "notes": { "type": ["string", "null"] }
      },
      "additionalProperties": false
    },

    "DialogueLine": {
      "type": "object",
      "required": [
        "id", "sceneId", "characterId", "orderIndex", "text",
        "type", "dialect", "register", "functions", "wordCount",
        "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string" },
        "sceneId": { "type": "string" },
        "characterId": { "type": "string" },
        "orderIndex": { "type": "integer" },
        "text": { "type": "string", "description": "نص الحوار" },
        "parenthetical": { "type": ["string", "null"], "description": "إرشاد أدائي" },
        "type": { "$ref": "#/definitions/DialogueType" },
        "dialect": { "$ref": "#/definitions/ArabicDialect" },
        "register": { "$ref": "#/definitions/LanguageRegister" },
        "functions": {
          "type": "array",
          "items": { "$ref": "#/definitions/DialogueFunction" },
          "minItems": 1,
          "description": "الوظائف الدرامية — يمكن أكثر من وظيفة"
        },
        "mood": { "$ref": "#/definitions/SceneMood" },
        "wordCount": { "type": "integer", "minimum": 0 },
        "isBilingual": { "type": "boolean", "default": false },
        "secondLanguage": { "type": ["string", "null"] },
        "translation": { "type": ["string", "null"] },
        "notes": { "type": ["string", "null"] },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },

    "ScreenplayElementBlock": {
      "type": "object",
      "required": [
        "id", "sceneId", "orderIndex", "elementType", "content",
        "createdAt", "updatedAt"
      ],
      "properties": {
        "id": { "type": "string" },
        "sceneId": { "type": "string" },
        "orderIndex": { "type": "integer" },
        "elementType": { "$ref": "#/definitions/ScreenplayElement" },
        "content": { "type": "string", "description": "المحتوى النصي" },
        "characterId": { "type": ["string", "null"] },
        "metadata": { "type": ["object", "null"] },
        "createdAt": { "type": "string", "format": "date-time" },
        "updatedAt": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },

    "SceneCharacter": {
      "type": "object",
      "required": ["id", "sceneId", "characterId"],
      "properties": {
        "id": { "type": "string" },
        "sceneId": { "type": "string" },
        "characterId": { "type": "string" },
        "isPresent": { "type": "boolean", "default": true, "description": "موجود في المشهد" },
        "isSpeaking": { "type": "boolean", "default": false, "description": "يتحدث في المشهد" },
        "isFirstAppearance": { "type": "boolean", "default": false, "description": "أول ظهور" }
      },
      "additionalProperties": false
    },

    "ProjectStats": {
      "type": "object",
      "required": [
        "totalScenes", "totalCharacters", "totalDialogueLines",
        "totalWords", "estimatedDurationMinutes"
      ],
      "properties": {
        "totalScenes": { "type": "integer" },
        "totalCharacters": { "type": "integer" },
        "totalDialogueLines": { "type": "integer" },
        "totalWords": { "type": "integer" },
        "estimatedDurationMinutes": { "type": "number" },
        "scenesPerLocation": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        },
        "dialoguePerCharacter": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        },
        "dialectDistribution": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        },
        "moodDistribution": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        },
        "avgWordsPerScene": { "type": "number" },
        "avgDialoguePerScene": { "type": "number" }
      },
      "additionalProperties": false
    }
  },

  "$ref": "#/definitions/ScreenplayProject"
}