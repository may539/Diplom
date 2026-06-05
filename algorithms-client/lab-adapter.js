/**
 * Клиентский адаптер: отображение лабораторий и паспортов кабинетов
 * поверх данных API (id oib/pd/zem без изменений на сервере).
 */
(function initLabAdapter(global) {
  const LAB_PASSPORTS = {
    oib: {
      code: "Каб. 304",
      title: "Лаборатория технических средств защиты информации",
      description:
        "Паспорт: Предназначена для проведения практических занятий по контролю эффективности защиты информации, поиску закладочных устройств и аттестации объектов.",
    },
    pd: {
      code: "Каб. 212",
      title: "Лаборатория криминалистики и специальной техники",
      description:
        "Паспорт: Обеспечивает проведение лабораторных работ по трасологии, дактилоскопии, фиксации вещдоков и изучению средств индивидуальной защиты.",
    },
    zem: {
      code: "Каб. 401",
      title: "Лаборатория геодезии и картографии",
      description:
        "Паспорт: Учебный класс для обработки результатов полевых измерений, работы с ГИС-системами, электронными тахеометрами и планами местности.",
    },
  };

  const CODE_TO_ID = {
    ОИБ: "oib",
    ПД: "pd",
    ЗЕМ: "zem",
  };

  const AVAILABLE_LAB_IDS = new Set(["oib", "pd", "zem"]);

  function resolveLabId(source) {
    if (!source) {
      return null;
    }

    const id = String(source.id || source.specialtyId || "").toLowerCase();
    if (LAB_PASSPORTS[id]) {
      return id;
    }

    const code = String(source.code || source.specialtyCode || "").trim().toUpperCase();
    return CODE_TO_ID[code] || null;
  }

  function getPassport(source) {
    const labId = resolveLabId(source);
    return labId ? LAB_PASSPORTS[labId] : null;
  }

  function adaptSpecialty(specialty) {
    if (!specialty) {
      return specialty;
    }

    const passport = getPassport(specialty);
    if (!passport) {
      return { ...specialty };
    }

    return {
      ...specialty,
      code: passport.code,
      title: passport.title,
      description: passport.description,
    };
  }

  function adaptSpecialties(list) {
    return (list || []).map((item) => ({
      ...adaptSpecialty(item),
      equipment: item.equipment || [],
    }));
  }

  function adaptTreeNodes(nodes) {
    return (nodes || []).map((node) => {
      const adapted = adaptSpecialty({
        id: node.id,
        code: node.code,
        title: node.name || node.title,
        description: node.description,
      });

      return {
        ...node,
        code: adapted.code,
        name: adapted.title,
        title: adapted.title,
        description: adapted.description,
        children: adaptTreeNodes(node.children || []),
      };
    });
  }

  function adaptSpecialtyTree(tree) {
    return adaptTreeNodes(tree);
  }

  function formatSelectLabel(item) {
    const adapted = adaptSpecialty(item);
    return `${adapted.code} — ${adapted.title}`;
  }

  function roomCodeFor(source) {
    return getPassport(source)?.code || "";
  }

  function isLabAvailable(labId) {
    return AVAILABLE_LAB_IDS.has(String(labId || "").toLowerCase());
  }

  function capitalizeCategory(text) {
    return String(text || "")
      .split(" · ")
      .map((part) => {
        const trimmed = part.trim();
        if (!trimmed) {
          return "";
        }
        return trimmed.charAt(0).toLocaleUpperCase("ru-RU") + trimmed.slice(1);
      })
      .join(" · ");
  }

  function stripLegacyMarkers(text) {
    return String(text || "")
      .split(/\s*·\s*/)
      .map((part) => part.trim())
      .map((part) => {
        const legacyTail = part.match(/^(?:ОИБ|ПД|ЗЕМ)\s+(.+)$/iu);
        return legacyTail ? legacyTail[1].trim() : part;
      })
      .filter((part) => part && !CODE_TO_ID[part.toUpperCase()])
      .join(" · ");
  }

  function categoryFromType(type) {
    const raw = String(type || "").trim();
    if (!raw) {
      return "";
    }

    const parts = raw.split("·").map((part) => part.trim()).filter(Boolean);
    let category = raw;

    if (parts.length > 1) {
      const first = parts[0].toUpperCase();
      const legacyPrefix = Boolean(CODE_TO_ID[first]);
      const roomPrefix = /^КАБ\.\s*\d+/i.test(parts[0]);
      category = legacyPrefix || roomPrefix ? parts.slice(1).join(" · ") : parts.join(" · ");
    } else {
      const legacyTail = raw.match(/^(?:ОИБ|ПД|ЗЕМ)\s+(.+)$/iu);
      category = legacyTail ? legacyTail[1] : raw;
    }

    const cleaned = stripLegacyMarkers(category) || category;
    return capitalizeCategory(cleaned);
  }

  function formatEquipmentType(type, specialty) {
    const category = categoryFromType(type);
    if (!category) {
      return "";
    }

    const roomCode = roomCodeFor(specialty);
    return roomCode ? `${roomCode} · ${category}` : category;
  }

  global.LabAdapter = {
    LAB_PASSPORTS,
    AVAILABLE_LAB_IDS,
    adaptSpecialty,
    adaptSpecialties,
    adaptSpecialtyTree,
    adaptTreeNodes,
    formatSelectLabel,
    roomCodeFor,
    resolveLabId,
    isLabAvailable,
    formatEquipmentType,
  };
})(window);
