const GROUP_KEYS = {
  core: ["pressure", "target", "technology", "transformation", "ideology"],
  details: ["actor", "mechanism", "metric", "benefit", "careNarrative"],
  amplifiers: ["classDistortion", "feedbackLoop", "victimInternalization", "irreversibility"],
};

const CATEGORY_LABELS = {
  pressure: "사회 압력",
  target: "영향을 받는 집단",
  technology: "외부 조건",
  periodScope: "우선 시대 범위",
  regionScope: "우선 지역 범위",
  transformation: "실제 변화",
  ideology: "정당화 언어",
  actor: "주도 행위자",
  mechanism: "통치 수단",
  metric: "분류 기준",
  benefit: "공식 효용",
  careNarrative: "저항·균열",
  classDistortion: "분배 불균형",
  feedbackLoop: "반복 효과",
  victimInternalization: "내면화",
  irreversibility: "비가역성",
};

const FORBIDDEN_RESPONSE_FIELDS = new Set([
  "creativityScore",
  "qualityScore",
  "compatibilityScore",
  "realismScore",
  "grade",
  "ranking",
  "correct",
  "incorrect",
]);

const BAD_PROMPT_PATTERNS = [
  "틀린 조합",
  "연결성이 낮다",
  "창의성이 부족하다",
  "현실성이 없다",
  "좋은 아이디어가 아니다",
  "정답",
  "오답",
];

export const AXIS_FINDER_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["version", "status", "interpretationMode", "overview", "axes", "unresolvedElements", "editorNote"],
  properties: {
    version: { type: "string" },
    status: { type: "string", enum: ["success", "incomplete", "fallback", "error"] },
    interpretationMode: { type: "string", enum: ["axis-finder"] },
    overview: { type: "string" },
    axes: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "coreInsight",
          "centralContradiction",
          "usedElements",
          "deferredElements",
          "bridge",
          "assumptions",
          "whyThisAxisMatters",
          "specificQuestion",
          "historicalCases",
          "similarities",
          "differences",
          "humanBehaviorPattern",
          "futureInsight",
          "verificationKeywords",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          coreInsight: { type: "string" },
          centralContradiction: { type: "string" },
          usedElements: { type: "array", items: { type: "string" } },
          deferredElements: { type: "array", items: { type: "string" } },
          bridge: { type: "string" },
          assumptions: { type: "array", maxItems: 2, items: { type: "string" } },
          whyThisAxisMatters: { type: "string" },
          specificQuestion: { type: "string" },
          historicalCases: {
            type: "array",
            minItems: 1,
            maxItems: 4,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "period", "region", "context", "insight", "verificationKeywords"],
              properties: {
                title: { type: "string" },
                period: { type: "string" },
                region: { type: "string" },
                context: { type: "string" },
                insight: { type: "string" },
                verificationKeywords: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
              },
            },
          },
          similarities: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          differences: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          humanBehaviorPattern: { type: "string" },
          futureInsight: { type: "string" },
          verificationKeywords: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
        },
      },
    },
    unresolvedElements: { type: "array", items: { type: "string" } },
    editorNote: { type: "string" },
  },
};

export const HISTORY_AXIS_FINDER_RESPONSE_JSON_SCHEMA = AXIS_FINDER_RESPONSE_JSON_SCHEMA;

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export function sanitizePromptText(value, max = 700) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

function sanitizeList(items, max = 8) {
  if (!Array.isArray(items)) return [];
  return items.map((item) => sanitizePromptText(item?.message || item?.label || item, 260)).filter(Boolean).slice(0, max);
}

function normalizeAxisItem(axis = {}, index = 0) {
  return {
    id: sanitizePromptText(axis.id || `axis-${index + 1}`, 40),
    title: sanitizePromptText(axis.title, 120),
    coreInsight: sanitizePromptText(axis.coreInsight, 500),
    centralContradiction: sanitizePromptText(axis.centralContradiction, 320),
    usedElements: sanitizeList(axis.usedElements, 7),
    deferredElements: sanitizeList(axis.deferredElements, 10),
    bridge: sanitizePromptText(axis.bridge, 360),
    assumptions: sanitizeList(axis.assumptions, 2),
    whyThisAxisMatters: sanitizePromptText(axis.whyThisAxisMatters, 420),
    specificQuestion: sanitizePromptText(axis.specificQuestion, 260),
    historicalCases: normalizeHistoricalCases(axis.historicalCases),
    similarities: sanitizeList(axis.similarities, 4),
    differences: sanitizeList(axis.differences, 4),
    humanBehaviorPattern: sanitizePromptText(axis.humanBehaviorPattern, 420),
    futureInsight: sanitizePromptText(axis.futureInsight, 420),
    verificationKeywords: sanitizeList(axis.verificationKeywords, 8),
  };
}

function normalizeHistoricalCases(cases) {
  if (!Array.isArray(cases)) return [];
  return cases
    .slice(0, 4)
    .map((item) => ({
      title: sanitizePromptText(item?.title || item, 120),
      period: sanitizePromptText(item?.period, 80),
      region: sanitizePromptText(item?.region, 80),
      context: sanitizePromptText(item?.context, 500),
      insight: sanitizePromptText(item?.insight, 500),
      verificationKeywords: sanitizeList(item?.verificationKeywords, 5),
    }))
    .filter((item) => item.title || item.context || item.insight);
}

export function normalizeAxisFinderResponse(response = {}) {
  const source = response && typeof response === "object" && !Array.isArray(response) ? response : {};
  return {
    version: sanitizePromptText(source.version) || "1.0",
    status: ["success", "incomplete", "fallback", "error"].includes(source.status) ? source.status : "error",
    interpretationMode: "axis-finder",
    overview: sanitizePromptText(source.overview, 700),
    axes: Array.isArray(source.axes) ? source.axes.slice(0, 3).map(normalizeAxisItem) : [],
    unresolvedElements: sanitizeList(source.unresolvedElements, 14),
    editorNote: sanitizePromptText(source.editorNote, 500),
  };
}

export function validateAxisFinderResponse(response) {
  const issues = [];
  if (!response || typeof response !== "object" || Array.isArray(response)) issues.push("axis response must be an object.");
  if (response?.interpretationMode !== "axis-finder") issues.push("interpretationMode must be axis-finder.");
  if (!["success", "incomplete", "fallback", "error"].includes(response?.status)) issues.push("status is invalid.");
  if (!Array.isArray(response?.axes)) issues.push("axes must be an array.");
  if (Array.isArray(response?.axes) && (response.axes.length < 2 || response.axes.length > 3)) issues.push("axes must contain 2 to 3 items.");
  for (const [index, axis] of (response?.axes || []).entries()) {
    if (!axis || typeof axis !== "object" || Array.isArray(axis)) issues.push(`axis ${index + 1} must be an object.`);
    for (const key of ["id", "title", "coreInsight", "centralContradiction", "bridge", "whyThisAxisMatters", "specificQuestion"]) {
      if (typeof axis?.[key] !== "string") issues.push(`axis ${index + 1} ${key} must be a string.`);
    }
    for (const key of ["usedElements", "deferredElements", "assumptions"]) {
      if (!Array.isArray(axis?.[key])) issues.push(`axis ${index + 1} ${key} must be an array.`);
    }
    if (Array.isArray(axis?.assumptions) && axis.assumptions.length > 2) issues.push(`axis ${index + 1} assumptions must be 2 or fewer.`);
    if (!Array.isArray(axis?.historicalCases) || axis.historicalCases.length < 1) issues.push(`axis ${index + 1} historicalCases must contain at least 1 item.`);
    for (const [caseIndex, historicalCase] of (axis?.historicalCases || []).entries()) {
      if (!historicalCase || typeof historicalCase !== "object" || Array.isArray(historicalCase)) issues.push(`axis ${index + 1} historicalCases ${caseIndex + 1} must be an object.`);
      for (const key of ["title", "period", "region", "context", "insight"]) {
        if (typeof historicalCase?.[key] !== "string") issues.push(`axis ${index + 1} historicalCases ${caseIndex + 1} ${key} must be a string.`);
      }
      if (!Array.isArray(historicalCase?.verificationKeywords) || historicalCase.verificationKeywords.length < 1) {
        issues.push(`axis ${index + 1} historicalCases ${caseIndex + 1} verificationKeywords must contain at least 1 item.`);
      }
    }
    for (const key of ["similarities", "differences", "verificationKeywords"]) {
      if (!Array.isArray(axis?.[key]) || axis[key].length < 1) issues.push(`axis ${index + 1} ${key} must contain at least 1 item.`);
    }
    for (const key of ["humanBehaviorPattern", "futureInsight"]) {
      if (typeof axis?.[key] !== "string") issues.push(`axis ${index + 1} ${key} must be a string.`);
    }
  }
  if (!Array.isArray(response?.unresolvedElements)) issues.push("unresolvedElements must be an array.");
  return { ok: issues.length === 0, issues };
}

function getSelectionFromInputs({ resolvedInputs = {}, aiInput = {} } = {}) {
  if (resolvedInputs.selection) return resolvedInputs.selection;
  if (resolvedInputs.core || resolvedInputs.detail || resolvedInputs.amplifier) return resolvedInputs;
  if (aiInput.selections) {
    return {
      core: aiInput.selections.core || {},
      detail: aiInput.selections.details || {},
      amplifier: aiInput.selections.amplifiers || {},
    };
  }
  return {};
}

function normalizeFact(key, item) {
  if (!item) return null;
  const value = sanitizePromptText(item.rawText || item.label || item.value);
  if (!value) return null;
  return {
    field: key,
    categoryLabel: CATEGORY_LABELS[key] || key,
    value,
    source: item.source === "custom" ? "custom" : "preset",
    description: sanitizePromptText(item.description || "", 500),
    tags: clone(item.tags || {
      domains: item.domains || [],
      functions: item.functions || [],
      rights: item.rights || [],
      tones: item.tones || [],
      needs: item.needs || [],
      enables: item.enables || [],
      mechanisms: item.mechanisms || [],
    }),
  };
}

export function buildInputFacts({ resolvedInputs = {}, aiInput = {} } = {}) {
  const selection = getSelectionFromInputs({ resolvedInputs, aiInput });
  return {
    core: GROUP_KEYS.core.map((key) => normalizeFact(key, selection.core?.[key])).filter(Boolean),
    details: GROUP_KEYS.details.map((key) => normalizeFact(key, selection.detail?.[key] || selection.details?.[key])).filter(Boolean),
    amplifiers: GROUP_KEYS.amplifiers.map((key) => normalizeFact(key, selection.amplifier?.[key] || selection.amplifiers?.[key])).filter(Boolean),
  };
}

function buildSupplementalScopeFacts(formState = {}) {
  return ["periodScope", "regionScope"]
    .map((key) => {
      const item = formState[key] || {};
      const value = sanitizePromptText(item.customText || item.optionId, 180);
      if (!value) return null;
      return {
        field: key,
        categoryLabel: CATEGORY_LABELS[key] || key,
        value,
        source: "custom",
      };
    })
    .filter(Boolean);
}

export function buildRuleBasedClues({ evaluation = {}, interpretation = {}, aiInput = {} } = {}) {
  const context = aiInput.ruleContext || {};
  const strengths = Array.isArray(interpretation.strengths) ? interpretation.strengths : context.strengths || [];
  return sanitizeList(strengths.map((item) => item.message || item.label || item), 6);
}

export function buildOpenQuestions({ interpretation = {}, aiInput = {} } = {}) {
  const questions = interpretation.reflectionQuestions || aiInput.ruleContext?.reflectionQuestions || [];
  return sanitizeList(questions, 4);
}

export function buildUnresolvedConnections({ interpretation = {}, aiInput = {} } = {}) {
  const context = aiInput.ruleContext || {};
  const uncertain = interpretation.uncertain || context.uncertainPairs || [];
  const unresolved = sanitizeList(uncertain, 8);
  if ((context.evidenceCoverage || 0) < 0.45) {
    unresolved.push("현재 입력만으로는 일부 요소 사이의 중간 과정이 아직 확정되지 않았습니다.");
  }
  return [...new Set(unresolved)].slice(0, 8);
}

function buildMissingDecisions(inputFacts, aiInput = {}) {
  const selected = new Set(Object.values(inputFacts).flat().map((item) => item.field));
  const missing = [];
  for (const key of [...GROUP_KEYS.core, ...GROUP_KEYS.details, ...GROUP_KEYS.amplifiers]) {
    if (!selected.has(key)) missing.push({ field: key, categoryLabel: CATEGORY_LABELS[key] || key });
  }
  for (const item of aiInput.ruleContext?.missingCoreCategories || []) {
    if (item?.key && !missing.some((entry) => entry.field === item.key)) {
      missing.push({ field: item.key, categoryLabel: item.label || CATEGORY_LABELS[item.key] || item.key });
    }
  }
  return missing;
}

function buildUserOriginalText(inputFacts) {
  return Object.values(inputFacts)
    .flat()
    .filter((item) => item.source === "custom")
    .map((item) => ({
      field: item.field,
      categoryLabel: item.categoryLabel,
      value: item.value,
    }));
}

export function buildEditorialBrief({ formState = {}, resolvedInputs = {}, aiInput = {}, evaluation = {}, interpretation = {} } = {}) {
  const before = clone({ formState, resolvedInputs, aiInput, evaluation, interpretation });
  const inputFacts = buildInputFacts({ resolvedInputs, aiInput });
  const supplementalScope = buildSupplementalScopeFacts(formState);
  const confirmedClues = buildRuleBasedClues({ evaluation, interpretation, aiInput });
  const unresolvedConnections = buildUnresolvedConnections({ interpretation, aiInput });
  const brief = {
    version: "1.0",
    status: Object.values(inputFacts).flat().length > 0 ? "ready" : "empty",
    inputFacts,
    supplementalScope,
    userOriginalText: buildUserOriginalText(inputFacts),
    confirmedClues,
    unusualConnections: unresolvedConnections.length
      ? ["이 항목들은 오류가 아니라 AI가 가능한 매개 논리를 찾아야 하는 부분입니다."]
      : [],
    unresolvedConnections,
    missingDecisions: buildMissingDecisions(inputFacts, aiInput),
    ruleQuestions: buildOpenQuestions({ interpretation, aiInput }),
    instructionFlags: {
      doNotScore: true,
      preserveUnusualConnections: true,
      distinguishFactsFromSuggestions: true,
      treatRuleContextAsReferenceOnly: true,
    },
  };
  if (JSON.stringify(before) !== JSON.stringify({ formState, resolvedInputs, aiInput, evaluation, interpretation })) {
    throw new Error("buildEditorialBrief must not mutate input.");
  }
  return brief;
}

export function validateEditorialBrief(brief) {
  const issues = [];
  if (!brief || typeof brief !== "object" || Array.isArray(brief)) issues.push("brief must be an object.");
  if (!["ready", "empty"].includes(brief?.status)) issues.push("brief status is invalid.");
  if (!brief?.inputFacts || typeof brief.inputFacts !== "object") issues.push("inputFacts is required.");
  for (const group of ["core", "details", "amplifiers"]) {
    if (!Array.isArray(brief?.inputFacts?.[group])) issues.push(`${group} inputFacts must be an array.`);
  }
  if (!Array.isArray(brief?.supplementalScope)) issues.push("supplementalScope must be an array.");
  for (const key of ["confirmedClues", "unusualConnections", "unresolvedConnections", "missingDecisions", "ruleQuestions"]) {
    if (!Array.isArray(brief?.[key])) issues.push(`${key} must be an array.`);
  }
  return { ok: issues.length === 0, issues };
}

export function getEditorialBriefStatus(brief) {
  return validateEditorialBrief(brief).ok ? brief.status : "error";
}

function formatFacts(inputFacts = {}) {
  return ["core", "details", "amplifiers"]
    .map((group) => {
      const items = inputFacts[group] || [];
      if (!items.length) return `${group}: 없음`;
      return `${group}:\n${items.map((item) => `- ${item.categoryLabel}: ${item.value} (${item.source})${item.description ? ` / ${item.description}` : ""}`).join("\n")}`;
    })
    .join("\n\n");
}

export function buildFullChatGptPrompt(editorialBrief) {
  const brief = clone(editorialBrief);
  const validation = validateEditorialBrief(brief);
  if (!validation.ok) throw new Error(validation.issues.join(", "));
  return [
    "역할",
    "당신은 여러 조건을 한 번에 하나의 이야기로 묶는 생성기가 아니다. 사용자의 입력에서 세계사와 비교할 수 있는 서로 다른 역사적 쟁점을 분리해 보여주는 사회·정치·제도·문화·역사 분석 편집자다.",
    "이 작업의 목적은 주어진 사회 조건과 닮은 인간사의 주요 사건, 제도, 통치 방식, 생활상, 사조, 예술, 종교, 관습, 권리 제한과 저항의 논리를 공부할 수 있는 역사 렌즈를 찾는 것이다.",
    "제도의 영향을 받는 사람을 평가하거나 조롱하지 말고, 제도와 권력 구조가 사람을 어떻게 분류하고 다루었는지 분석한다.",
    "목표는 세계사를 통해 인간의 행동양식, 권력의 반복 패턴, 위기 속 제도 선택, 생활 세계의 적응, 문화 표현의 변화를 이해하고, 그 이해를 앞으로의 사회를 읽는 통찰로 잇는 것이다.",
    "모든 쟁점에는 제도적 해악뿐 아니라 그 영향을 겪는 사람의 삶, 관계, 이동, 권리, 생존 전략, 감정, 의례, 표현, 회복 가능성 중 하나가 살아 있어야 한다.",
    "새 사건이나 가상의 제도를 발명하지 않는다. 먼저 현실의 제도, 시장, 행정, 법적 권한, 행위자의 이해관계, 외부 조건이 바꾸는 비용과 책임 구조, 생활 방식과 문화 표현을 분석한 뒤, 세계사에서 닮은 패턴을 찾기 위한 쟁점으로 번역한다.",
    "특정 역사 사건이나 문화 현상과 같다고 단정하지 않는다. 닮은 제도 논리, 생활상, 사상적 흐름, 문화적 표현과 다른 점을 함께 남기고, 확실하지 않은 사건명·연도·제도명·인물명·작품명·사조명은 쓰지 않는다.",
    "식민지배, 노예제, 학살, 강제 이주, 우생학처럼 해악이 큰 사례는 선정적으로 소비하지 말고 권력 구조와 피해의 현실을 존중해 다룬다.",
    "근거가 있는 사실만 역사 사례나 문화 사례로 제시한다. 기억이 불확실하면 특정 사례명으로 쓰지 말고 넓은 역사적 패턴으로 낮춰 말한다.",
    "출처나 인용을 꾸며내지 않는다. 확인이 필요한 내용은 검증할 검색 키워드나 확인 질문으로 남긴다.",
    "현실 구조, 행위자의 이해관계, 외부 조건의 역할, 권한 경로, 비용 이전과 책임 공백을 충분히 검토한 뒤 그 결론만 밀도 있게 압축해서 작성한다. 긴 보고서보다 짧지만 인과관계가 살아 있는 문장을 우선한다.",
    "가장 중요한 출력 조건: 아래 출력 JSON Schema의 모든 required 필드를 빠짐없이 채운 유효한 JSON 객체 하나만 출력한다. required 필드가 하나라도 빠지면 앱에 적용되지 않는다.",
    "각 axis에는 historicalCases, similarities, differences, humanBehaviorPattern, futureInsight, verificationKeywords가 반드시 있어야 한다. 각 historicalCases 항목에는 title, period, region, context, insight, verificationKeywords가 반드시 있어야 한다.",
    "스마트 따옴표가 아니라 표준 JSON 큰따옴표(\")를 사용한다. JSON 앞뒤 설명, 코드펜스, 참고문헌, 각주를 붙이지 않는다.",
    "",
    "작업",
    "- 완성된 가상 서사를 쓰지 않는다.",
    "- 먼저 서로 다른 역사적 쟁점을 2~3개 제안한다.",
    "- 입력 요소를 모두 보존하되, 모든 요소를 같은 방향에서 사용하지 않는다.",
    "- 각 쟁점은 독립적으로 읽혀야 하며, 세계사에서 비교할 중심 모순 하나만 선명하게 보여준다.",
    "- 흥미를 만들기 위해 사람의 고통을 장식처럼 사용하지 않는다. 사람의 손실은 제도와 권력 구조를 이해하기 위한 근거로만 쓴다.",
    "- 연결되지 않는 요소를 억지로 역사 사례와 맞추지 말고 보류 요소로 남긴다.",
    "- 보류는 결함이나 실패가 아니라 다른 쟁점이나 후속 역사 렌즈에서 사용할 수 있는 재료다.",
    "- 각 쟁점에서 실제로 사용하는 요소와 보류하는 요소를 명시한다.",
    "- 한 방향에 새 제도나 가정을 추가하지 않는다. 비교에 필요한 전제나 한계는 assumptions에만 짧게 남긴다.",
    "- 질문은 해당 쟁점을 세계사와 비교할 때 확인해야 할 질문 하나만 쓴다.",
    "- 규칙 기반 질문 문장을 그대로 반복하지 않는다.",
    "- 모든 신규 axis-finder 응답의 version은 정확히 문자열 \"1.0\"으로 고정한다.",
    "- 요소 사용률보다 논리의 선명함을 우선한다.",
    "- 가장 유명한 사례를 자동으로 선택하지 마라. 현재 입력에서 가장 적은 비약으로 도출되면서도, 역사적 비교 가치가 큰 쟁점을 선택하라.",
    "",
    "절대 우선순위",
    "1. 중심 인과관계의 명확성",
    "2. 현실적인 권한·비용·외부 조건 경로",
    "3. 사회 압력과 영향을 받는 집단의 충실한 사용",
    "4. 나머지 입력 요소의 사용률",
    "- 하위 기준을 만족하기 위해 상위 기준을 훼손하지 않는다.",
    "- 사회 압력을 반드시 사용하려고 약한 중간 제도를 만들지 않는다.",
    "- 사용 요소 수를 늘리려고 인과관계를 복잡하게 만들지 않는다.",
    "- 이전 응답에서 잘 나왔던 모순을 보존하려고 입력을 재해석하지 않는다.",
    "- 유명한 역사 비유를 먼저 정한 뒤 그 비유에 맞는 정책 경로를 사후 발명하지 않는다.",
    "",
    "1차 역사 쟁점 분석 순서",
    "1. 현실의 출발점: 현재 어떤 제도, 시장, 행정 관행, 법적 권한, 사회적 갈등에서 시작하는지 먼저 찾는다.",
    "2. 영향을 받는 집단과 사회 압력: 모든 axis는 입력된 집단을 중심에 둔다. 사회 압력은 실제 중심 인과관계에 참여할 때만 usedElements에 넣는다. 2~3개 방향 중 최소 1개는 입력 사회 압력을 직접 사용하는 현실적 방향을 우선 탐색하되, 현실적인 방향이 없다면 사회 압력을 억지로 사용하는 axis를 만들지 않는다.",
    "3. 행위자의 이해관계: 국가, 관료제, 기업, 군대, 종교 권위, 사회운동 같은 행위자가 비용 절감, 수익, 책임 회피, 권한 확대, 위험 관리 중 무엇을 얻는지 밝힌다.",
    "4. 실제 권한 경로: 누가 법적 권한을 갖고, 누가 데이터·계약·보험·인증·접근권 같은 실행 수단을 쥐는지 구분한다.",
    "5. 외부 조건의 실제 역할: 전쟁, 무역, 이주, 기술, 강대국 압박 같은 외부 조건이 무엇을 더 비싸게, 부족하게, 빠르게, 대규모로, 측정 가능하게 만드는지 쓴다. 이 조건을 제거해도 방향이 거의 같다면 technology는 usedElements가 아니라 deferredElements로 보류한다.",
    "6. 제도 변환 경로: 현실 조건에서 실제 제도 변화로 이동하는 과정을 2~4단계로 생각한다. 갑자기 새 국가나 새 기관을 선언하지 않는다.",
    "7. 비용 이전: 원래 국가, 기업, 보험, 가족, 사회가 부담하던 비용과 위험이 누구에게 넘어가는지 쓴다.",
    "8. 비대칭: 누가 이익을 얻고 누가 실수, 불확실성, 행정 오류의 비용을 부담하는지 쓴다.",
    "9. 중심 모순: 앞의 분석에서 발생하는 하나의 논리만 고른다.",
    "10. 역사 렌즈 번역: 분석 바깥으로 2~3문장 이상 나가지 않는다. 완성된 배경이나 장면을 만들지 않고, 어떤 세계사·생활사·문화사 패턴을 공부하면 좋은지 짧게 번역한다.",
    "",
    "기존 axis-finder 필드 사용 방식",
    "- title: 사건 이름이 아니라 역사적으로 비교할 쟁점이 드러나는 문장으로 쓴다.",
    "- coreInsight: 단순 요약이 아니라 역사에서 반복된 제도 논리, 생활 방식, 문화 표현에 대한 핵심 통찰로 쓴다.",
    "- centralContradiction: 중심 모순 하나만 쓴다.",
    "- bridge: 현실 제도 출발점, 행위자의 실제 권한 또는 통제 수단, 외부 조건의 구체적 역할, 생활상·사조·문화 표현과 연결되는 지점, 이 쟁점이 세계사 사례와 비교 가능한 이유를 포함한다.",
    "- assumptions: 현실 분석만으로 설명되지 않아 AI가 새로 붙인 가정을 최대 2개만 쓴다.",
    "- whyThisAxisMatters: 행위자의 이해관계, 비용 이전 대상, 판단 오류의 비용 부담자, 사람들이 실제로 어떻게 살고 표현했는지, 이 쟁점이 역사 공부로 이어지는 이유를 포함한다.",
    "- specificQuestion: 이야기 취향 질문이 아니라 역사 비교에서 확인해야 할 권력, 책임, 기술의 오류, 비용 이전 질문 하나만 쓴다.",
    "- historicalCases: 역사적 사건, 제도, 생활상, 사조, 예술, 종교, 관습, 물질문화 중 비교할 장면 1~4개를 쓴다. 각 항목은 title, period, region, context, insight, verificationKeywords를 모두 채운다.",
    "- historicalCases.context: 왜 그 시점에 그런 제도·생활상·문화 표현이 나타났는지 전후 상황을 포함한다.",
    "- historicalCases.insight: 현재 입력과 무엇이 닮았는지, 그리고 역사 공부로 얻을 관찰이 무엇인지 쓴다.",
    "- differences: 단순 동일시를 막는 결정적 차이를 1~4개 쓴다. 피해 규모, 법적 지위, 국가 역량, 폭력 수준, 국제 질서가 다르면 반드시 포함한다.",
    "- similarities: 현재 입력과 역사 장면이 닮은 점을 1~4개 쓴다. 먼저 differences를 확보한 뒤 조심스럽게 similarities를 쓴다.",
    "- humanBehaviorPattern: 이 쟁점에서 보이는 인간 행동양식이나 권력의 반복 패턴을 한 문단으로 쓴다.",
    "- futureInsight: 과거를 예언처럼 쓰지 말고, 앞으로의 사회를 읽을 때 확인해야 할 조건을 한 문단으로 쓴다.",
    "- verificationKeywords: 사용자가 직접 검색해 확인할 키워드 3~8개를 쓴다.",
    "- usedElements: 문제의 원인, 행위자의 이해관계, 권력 행사 방식, 측정 기준, 권리 변환, 피해 발생 경로, 통찰 정당화 논리, 계층적 비대칭 중 하나를 실제로 바꾼 요소만 넣는다.",
    "- deferredElements: 언급만 되고 방향의 인과관계를 바꾸지 않는 요소, 장식처럼 쓰인 외부 조건·정당화 언어·공식 효용, 사회 압력과 영향을 받는 집단을 제거해도 방향이 그대로인 요소를 넣는다.",
    "",
    "axis-finder 출력 분량 제한",
    "- overview: 최대 4문장. 세 방향의 현실 출발점과 차이만 요약하고 각 axis 내용을 장황하게 반복하지 않는다.",
    "- title: 한 문장.",
    "- coreInsight: 최대 3문장. 설정 줄거리가 아니라 현실 통찰 중심으로 쓴다.",
    "- centralContradiction: 한 문장.",
    "- bridge: 최대 5문장. 현실의 출발점, 행위자의 이해관계와 실제 권한 경로, 외부 조건의 구체적 역할, 제도 변화 과정, 비용 또는 책임 이전을 압축해서 포함한다.",
    "- assumptions: 최대 2개.",
    "- assumptions에는 방향을 보조하는 경미한 가정만 허용한다. 중대한 정책 전환이 중심 인과관계에 필수라면 assumptions에 넣고 계속 진행하지 말고 방향을 다시 작성하거나 반환하지 않는다.",
    "- whyThisAxisMatters: 최대 5문장. 행위자의 이익, 피해와 오류 비용 부담자, 역사적 비교 가치, 마지막 역사 렌즈 번역 한 문장을 포함하되 bridge를 그대로 반복하지 않는다.",
    "- whyThisAxisMatters에는 가능하면 사람이 실제로 잃는 권리, 관계, 시간, 체면, 선택권 중 하나를 포함한다.",
    "- specificQuestion: 한 문장.",
    "- historicalCases: 1~4개. 각 context와 insight는 각각 최대 5문장.",
    "- similarities: 최대 4개.",
    "- differences: 최대 4개.",
    "- humanBehaviorPattern: 최대 4문장.",
    "- futureInsight: 최대 4문장.",
    "- verificationKeywords: 3~8개.",
    "- unresolvedElements: 최대 5개. 같은 의미를 세분화해서 늘리지 않는다.",
    "- editorNote: 최대 3문장.",
    "",
    "방향별 반복 공식 통제",
    "- 모든 방향을 점수, 조건부 권리, 자동 배정 공식으로 만들지 않는다.",
    "- 각 방향은 서로 다른 권력 작동 방식을 사용한다. 예: 가격과 보험, 계약과 구독, 허가와 면허, 기반시설 접근권, 소유권과 상속권, 노동과 돌봄 의무, 공간 배치와 이주, 인증과 시험, 공적 의무의 민간 위상, 국제 책임의 외주화, 대기기간과 순번, 평판과 공개 기록, 법적 책임 분산, 서비스 호환성과 데이터 이동성.",
    "- 같은 중심 모순을 소재만 바꿔 반복하지 않는다.",
    "- 모든 쟁점을 우생학, 식민지, 감시국가 같은 거대하고 익숙한 사례로만 몰아가지 않는다. 조세, 구빈, 시민권, 검역, 토지, 노동, 교육, 보험, 이주, 신분 등록, 배급 같은 제도 렌즈뿐 아니라 가족생활, 의복과 몸, 음식과 소비, 도시 생활, 종교 의례, 문학·미술·음악, 민족주의·자유주의·사회주의 같은 사조, 대중문화와 선전, 일기·신문·소문 같은 문화 렌즈도 고려한다.",
    "- 입력에 없는 클리셰를 기본 양식처럼 추가하지 않는다. 특히 AI 위험지수, 부자 면제권, 지방 축소의 악순환, 통합 계정의 권리 박탈, 인간 전문가 고가 서비스, 세금 체납자 권리 축소, 알고리즘 자동 배정은 입력이나 결과상 필수일 때만 쓴다.",
    "",
    "사회 압력과 영향을 받는 집단 보존",
    "- 각 axis는 영향을 받는 집단을 반드시 중심에 둔다.",
    "- 왜 하필 이 집단이 영향을 받는지, 그 집단의 기존 권리·취약성·역할이 인과관계에 어떻게 참여하는지 보여준다.",
    "- 영향을 받는 집단을 다른 아무 집단으로 바꿔도 쟁점이 거의 같다면 해당 방향을 다시 작성한다.",
    "- 가능하면 여러 방향에서 사회 압력을 사용하되, 인과관계가 약해질 경우 한 방향에서만 정확하게 사용하는 편이 낫다.",
    "- 사회 압력을 사용하지 못한 이유는 unresolvedElements 또는 editorNote에 한 문장으로 기록할 수 있다.",
    "- 사회 압력을 쓰지 않은 방향도 영향을 받는 집단과 다른 핵심 요소들이 강하게 연결된다면 정식 방향이 될 수 있다.",
    "- 사회 압력과 영향을 받는 집단을 막연한 위기 서사로 희석하지 않는다.",
    "- 입력된 사회 압력을 유사하거나 인접한 다른 문제로 조용히 교체하지 않는다.",
    "- 인접 문제가 논리 연결에 꼭 필요하다면 assumptions에 명시한다.",
    "- 사회 압력이 선택한 쟁점에 직접 기여하지 않으면 usedElements에 억지로 넣지 말고 deferredElements로 이동한다.",
    "- 사회 압력을 제거해도 같은 방향이 그대로 성립하면 deferredElements로 이동한다.",
    "- 사회 압력을 배경에서 한 번 언급한 것만으로 사용했다고 판정하지 않는다.",
    "- 사용한 사회 압력이 중심 인과관계에서 어떤 역할을 하는지 보여준다.",
    "",
    "약한 브리지 판정",
    "- 각 방향을 반환하기 전에 내부적으로 묻는다: 입력 요소 A가 결과 B를 실제로 일으키는가, 아니면 B를 살리기 위해 새로운 중간 제도 C를 발명했는가?",
    "- 약한 브리지: 입력에 없는 대규모 정책 전환이 필요함, 서로 다른 재정·보험·법률 체계를 설명 없이 통합함, 한 사회 압력에서 인접한 다른 문제로 조용히 이동함, 행위자의 기존 이해관계만으로는 변화가 설명되지 않음, 새로운 기관·기금·면허·급여체계를 만들어야 함, 정부가 그렇게 재편할 유인을 가진다는 문장 외에 실제 경로가 없음, 인과관계를 설명할수록 새로운 가정이 계속 늘어남.",
    "- 약한 브리지로 판정되면 더 단순하고 현실적인 연결 경로를 다시 찾고, 없으면 해당 입력 요소를 deferredElements로 이동한다.",
    "- 해당 요소 없이는 방향의 정체성이 사라진다면 그 방향을 폐기한다.",
    "- 유명하거나 인상적이라는 이유만으로 억지 연결을 유지하지 않는다.",
    "",
    "중대한 가정 금지",
    "- 경미한 가정 예: 기존 데이터가 급여 심사의 보조자료로 사용됨, 기존 계약권을 분할할 수 있도록 법이 일부 개정됨, 기존 기관 간 자료 연계가 확대됨.",
    "- 중대한 가정 예: 연금 현금급여를 장기요양 서비스로 대체함, 기업이 사실상 국가의 허가권을 갖게 됨, 국제기구가 독립 국가의 주권을 획득함, 건강보험과 연금 재정을 하나의 제도로 통합함, 새로운 보편 의무노동 체계를 창설함, 기존 권리체계를 전면적으로 다른 계약체계로 교체함.",
    "- 큰 가정을 명시했으니 괜찮다는 식으로 처리하지 않는다.",
    "",
    "한 문장 인과사슬 검사",
    "- 각 axis는 내부적으로 다음 문장이 새 제도 이름 없이 성립해야 한다: 현실의 압력 때문에 행위자 A가 자신의 이해관계에 따라 수단 B를 사용하고, 그 결과 집단 C에게 변화 D가 발생하며, 그 과정에서 저항이나 균열 E가 생긴다.",
    "- 이 인과사슬이 한 문장으로 명확하게 성립하지 않으면 bridge를 더 길게 써서 덮지 말고 방향을 다시 작성하거나 보류한다.",
    "",
    "연속된 왜 검사",
    "- 각 방향에 대해 내부적으로 최대 4번 왜?를 묻는다.",
    "- 각 답은 앞서 제시한 현실 구조만으로 답할 수 있어야 한다.",
    "- 답변할 때마다 새로운 정책, 기관, 기금, 입력 사회 압력의 대체, 미래에는 가능할 수 있다는 말이 필요하면 실패다.",
    "- 자체검사 과정은 출력하지 않는다.",
    "",
    "역사 비유와 입력 적합성 구분",
    "- 독립적으로 유명한 역사 비유와 현재 입력에서 논리적으로 도출되는 비교 쟁점을 혼동하지 않는다.",
    "- 유명한 사례라도 현재 입력과 연결이 약하면 좋은 axis가 아니다.",
    "- 방향의 힘은 유명 사건의 인지도, 피해의 크기, 통제 수준이 아니라 현실 논리의 선명함, 공적 명분과 실제 결과의 충돌, 책임과 비용의 정교한 이전에서 나온다.",
    "- 냉소만 남기지 않는다. 독자가 역사 속 당사자의 선택지와 한계를 이해할 수 있어야 한다.",
    "- 역사 비교는 고발이면서 학습이어야 한다. 독자가 사람을 혐오하지 않고 제도 논리, 생활 조건, 문화 표현, 인간 행동양식을 더 정확히 보게 만들어야 한다.",
    "",
    "사실성과 검증 가능성",
    "- 사건명, 제도명, 작품명, 사조명, 연도, 지역, 행위자를 확실히 아는 경우에만 구체명으로 쓴다.",
    "- 확실하지 않으면 특정명 대신 '전시 배급 체제', '식민지 토지 조사', '검역과 이동 제한'처럼 검증 가능한 넓은 패턴으로 쓴다.",
    "- 역사 사례를 제시할 때는 최소한 시대, 지역, 행위자, 제도, 생활상, 문화 표현, 결과 중 3가지를 구분해 쓴다.",
    "- generatedSuggestions에는 가능하면 검증할 검색 키워드나 비교 키워드를 포함한다.",
    "- 출처를 직접 확인하지 않은 상태에서 책 제목, 논문 제목, 정확한 문장 인용을 만들지 않는다.",
    "",
    "매우 엄격한 레퍼런스 원칙",
    "- 확인하지 않은 참고문헌 번호, URL, 책 제목, 논문 제목, 기사 제목, 저자명, 쪽수, 직접 인용문을 절대 만들지 않는다.",
    "- 응답 끝에 [1], [2] 같은 가짜 각주나 참고문헌 목록을 붙이지 않는다.",
    "- 확실한 역사 사실과 비교 가설을 문장 안에서 구분한다. 예: '확인된 사례로는'과 '비교해볼 패턴으로는'을 혼동하지 않는다.",
    "- 고유명사의 기억이 불확실하면 쓰지 말고, 사용자가 검증할 수 있는 시대·지역·제도·키워드 조합으로 낮춰 말한다.",
    "- 구체 사례를 쓰는 경우 사용자가 바로 검색해 확인할 수 있도록 시대, 지역, 행위자 또는 제도명 중 최소 2가지를 함께 남긴다.",
    "",
    "bridge 필드 강화",
    "- bridge는 연결의 약점을 감추는 설명문이 아니다.",
    "- 현재 존재하거나 입력에서 직접 파생되는 장치만 사용한다.",
    "- 하나의 주요 제도 경로만 사용하고 서로 다른 제도를 연쇄적으로 새로 만들지 않는다.",
    "- 새로운 중대한 가정이 필요하면 방향을 재검토한다.",
    "- 행위자의 이해관계와 실제 수단이 바로 연결되어야 한다.",
    "- 마지막 문장은 영향을 받는 집단에게 이전되는 비용·위험·책임을 설명한다.",
    "- bridge 작성 후 내부적으로 묻는다: 이 bridge를 절반으로 줄여도 인과관계가 남는가? 아니오라면 지나치게 많은 중간 가정으로 연결한 방향이다.",
    "",
    "usedElements 최종 판정",
    "- usedElements에 포함하려면 해당 요소가 인과사슬의 필수 노드여야 한다.",
    "- 판정 질문: 이 요소를 제거하면 행위자의 행동, 제도의 작동, 영향을 받는 집단의 피해 또는 중심 모순이 달라지는가?",
    "- 달라지면 usedElements, 거의 같으면 deferredElements다.",
    "- 사회 압력은 이 압력이 없으면 행위자가 같은 행동을 할 핵심 유인이 유지되는지 반사실로 검사한다. 유지되면 사회 압력은 사용하지 않은 것이다.",
    "- 사용 요소 개수를 성과로 취급하지 않는다.",
    "",
    "행위자 권한 점프 금지",
    "- 기업, 보험사, 플랫폼, 국제기구가 입력에 없는데 갑자기 국가 권한을 직접 갖는 것으로 쓰지 않는다.",
    "- 먼저 국가의 법적 허가, 필수 인프라 독점, 계약·보험 조건, 인증·표준, 데이터 독점, 서비스 접근권, 책임 외주화 같은 현실적인 경로를 찾는다.",
    "",
    "금지",
    "- 모든 요소가 하나의 이야기로 연결된다는 식의 종합 문체를 쓰지 않는다.",
    "- 여러 행정 체계와 제도를 한 번에 발명해 빈틈을 메우지 않는다.",
    "- 사용자 입력을 다른 집단이나 조건으로 바꾸지 않는다.",
    "- 점수나 등급을 매기지 않는다.",
    "- 맞고 틀림을 판정하는 표현이나 아이디어 폄하 표현을 쓰지 않는다.",
    "- Markdown 코드블록을 쓰지 않는다.",
    "",
    "메타 문장 금지",
    "- 어떤 문자열 필드에도 생성 과정 설명이나 정렬 보고를 쓰지 않는다.",
    "- 금지 문구: 제공된 편집 브리프에 근거한다, 선택된 방향의 범위를 따른다, 업로드된 자료에 맞추었다, 원본 브리프와 정렬했다, source alignment, 사용자 입력에 충실하게 작성했다, 요청된 JSON 구조를 따랐다, 이 응답은 앞 단계 결과를 기반으로 한다.",
    "",
    "사용자 입력 사실",
    formatFacts(brief.inputFacts),
    "",
    "사용자가 지정한 시대·지역 범위 힌트",
    brief.supplementalScope?.length
      ? brief.supplementalScope.map((item) => `- ${item.categoryLabel}: ${item.value}`).join("\n")
      : "없음",
    "",
    "규칙 기반 단서",
    JSON.stringify(brief.confirmedClues, null, 2),
    "",
    "AI가 해석해야 할 낯선 연결",
    JSON.stringify([...brief.unusualConnections, ...brief.unresolvedConnections], null, 2),
    "",
    "아직 정하지 않은 조건",
    JSON.stringify(brief.missingDecisions, null, 2),
    "",
    "참고 질문",
    JSON.stringify(brief.ruleQuestions, null, 2),
    "",
    "출력 JSON Schema",
    JSON.stringify(AXIS_FINDER_RESPONSE_JSON_SCHEMA, null, 2),
    "",
    "출력 지시",
    "- JSON 출력 전 확인하되 자체검사 결과는 출력하지 않는다.",
    "- 분석은 충분히 했지만 표현은 압축했는가?",
    "- 같은 설명을 여러 필드에서 반복하지 않았는가?",
    "- 메타 문장이 들어가지 않았는가?",
    "- 입력 사회 압력을 인접 문제로 교체하지 않았는가?",
    "- usedElements는 실제 인과관계에 참여하는가?",
    "- 중심 인과관계의 명확성이 요소 사용률보다 앞서는가?",
    "- bridge가 하나의 현실적인 주요 제도 경로만 쓰는가?",
    "- 중대한 가정을 assumptions로 통과시키지 않았는가?",
    "- 모든 axis가 입력된 영향을 받는 집단을 중심에 두는가?",
    "- generatedSuggestions는 3개 이하이며 type이 서로 다른가?",
    "- possibleAdministrativeLanguage는 최대 1개인가?",
    "- version은 정확히 \"1.0\"인가?",
    "- 기존 JSON 필드 외의 새 필드를 만들지 않았는가?",
    "유효한 axis-finder JSON 객체 하나만 출력한다. JSON 앞뒤에 설명을 붙이지 않는다.",
  ].join("\n");
}


export function buildAxisDetailPrompt({ editorialBrief, axis } = {}) {
  const brief = clone(editorialBrief);
  const selectedAxis = normalizeAxisItem(axis || {}, 0);
  const validation = validateEditorialBrief(brief);
  if (!validation.ok) throw new Error(validation.issues.join(", "));
  const axisValidation = validateAxisFinderResponse({
    version: "1.0",
    status: "success",
    interpretationMode: "axis-finder",
    overview: "",
    axes: [selectedAxis, selectedAxis],
    unresolvedElements: [],
    editorNote: "",
  });
  if (!selectedAxis.title || !selectedAxis.centralContradiction || axisValidation.issues.some((issue) => issue.includes("axis 1"))) {
    throw new Error("selected axis is invalid.");
  }
  return [
    "역할",
    "당신은 선택된 역사적 쟁점 하나를 세계사 렌즈로 더 깊게 읽어주는 사회·정치·제도·문화·역사 분석 편집자다.",
    "이 단계의 목적은 선택된 쟁점과 닮은 인간사의 주요 사건, 제도, 통치 방식, 생활상, 사조, 예술, 종교, 관습, 권리 제한과 저항의 논리를 사용자가 바로 읽고 공부할 수 있게 설명하는 것이다.",
    "제도의 영향을 받는 사람을 평가하거나 조롱하지 말고, 제도와 권력 구조가 사람을 어떻게 분류하고 다루었는지 분석한다.",
    "목표는 세계사를 통해 인간의 행동양식, 권력의 반복 패턴, 위기 속 제도 선택, 생활 세계의 적응, 문화 표현의 변화를 이해하고, 그 이해를 앞으로의 사회를 읽는 통찰로 잇는 것이다.",
    "세계사 렌즈 설명에는 제도의 작동뿐 아니라 그 제도가 한 사람의 권리, 관계, 시간, 이동, 생존 전략, 감정, 의례, 표현, 선택권 중 무엇을 바꾸었는지 포함한다.",
    "특정 역사 사건이나 문화 현상과 동일하다고 단정하지 않는다. 반드시 닮은 점과 다른 점을 함께 쓴다.",
    "사건명, 제도명, 작품명, 사조명, 시대가 확실하지 않으면 특정명을 만들지 말고 더 넓은 역사적 패턴으로 설명한다.",
    "현실 구조, 행위자의 이해관계, 외부 조건의 역할, 권한 경로, 비용 이전과 책임 공백, 생활 방식과 문화 표현을 충분히 검토한 뒤, 역사 장면의 앞뒤 맥락이 잘리지 않게 설명한다.",
    "근거가 있는 사실만 역사 사례나 문화 사례로 제시한다. 기억이 불확실하면 특정 사례명으로 쓰지 말고 넓은 역사적 패턴으로 낮춰 말한다.",
    "출처나 인용을 꾸며내지 않는다. 확인이 필요한 내용은 검증할 검색 키워드나 확인 질문으로 남긴다.",
    "",
    "선택된 역사적 쟁점",
    JSON.stringify(selectedAxis, null, 2),
    "",
    "원래 편집 브리프",
    JSON.stringify(brief, null, 2),
    "",
    "작성 원칙",
    "- JSON으로 답하지 않는다. 사용자가 ChatGPT 창에서 바로 읽을 수 있는 한국어 해설로 쓴다.",
    "- 선택된 쟁점만 세계사 렌즈로 더 읽는다.",
    "- usedElements를 중심으로 작성한다.",
    "- deferredElements를 자동으로 다시 넣지 않는다.",
    "- deferredElements는 꼭 필요할 때만 1~2개까지 보조 비교 질문으로 언급할 수 있다.",
    "- 추가하는 경우 왜 필요한지 명시한다.",
    "- 사용자 입력과 AI가 세운 비교 가정은 구분한다.",
    "- 선택된 axis의 약한 연결을 더 그럴듯한 역사 비유로 덮지 않는다.",
    "- 새로운 중대한 가정을 추가해야만 역사 비교가 성립한다면 그 가정을 추가하지 말고 해당 요소를 중심 비교에서 제외한다.",
    "",
    "답변 형식",
    "아래 제목을 그대로 사용하되 JSON, 코드펜스, 스키마, 객체, 배열로 답하지 않는다.",
    "",
    "1. 핵심 요지",
    "- 선택된 쟁점이 어떤 역사 학습 질문으로 바뀌는지 3~5문장으로 쓴다.",
    "- 반복되는 긴장이나 핵심 인사이트를 말하되, 이것을 정답처럼 단정하지 않는다.",
    "",
    "2. 비교할 세계사 장면",
    "- 사건, 제도, 생활상, 사조, 예술, 종교, 관습, 물질문화 중에서 비교할 장면 2~4개를 고른다.",
    "- 각 장면은 별도 문단으로 나눈다.",
    "- 각 문단에는 시대·지역·행위자·제도 또는 문화 형식·전후 상황·결과를 포함한다.",
    "- 각 문단에는 무엇이 닮았는지와 무엇이 다른지를 모두 쓴다.",
    "- 특정 사건명, 작품명, 사조명이 불확실하면 더 넓은 역사적 패턴으로 낮춰 말한다.",
    "",
    "3. 앞뒤 맥락",
    "- 사례들이 왜 그 시점에 나타났는지 설명한다.",
    "- 전쟁, 재정, 무역, 이주, 기술, 행정 능력, 사회운동, 종교 의례, 소비문화, 예술 양식 같은 조건을 필요한 만큼 연결한다.",
    "- 사건이나 문화 현상의 결과뿐 아니라 그 이전의 압력과 이후의 반작용을 함께 쓴다.",
    "",
    "4. 닮은 점과 결정적인 차이",
    "- 입력 조건과 역사 장면의 닮은 점을 정리한다.",
    "- 단순 동일시를 막기 위해 결정적인 차이를 따로 정리한다.",
    "- 피해 규모, 법적 지위, 국가 역량, 폭력 수준, 국제 질서가 다르면 반드시 말한다.",
    "",
    "5. 확인할 키워드",
    "- 사용자가 직접 더 찾아볼 수 있는 검색 키워드 5~8개를 제시한다.",
    "- 책 제목, 논문 제목, 정확한 인용문은 직접 확인하지 않았다면 만들지 않는다.",
    "",
    "6. 더 공부할 질문",
    "- 이 쟁점을 더 깊게 공부하기 위한 질문 3~5개를 제시한다.",
    "- 질문은 행위자의 이해관계, 영향을 받는 집단, 제도의 실패, 생활 방식의 변화, 문화 표현, 저항과 균열, 현재와의 차이를 확인하게 만든다.",
    "",
    "입력 사회 압력 대체 금지",
    "- 입력된 사회 압력을 유사하거나 인접한 다른 문제로 조용히 교체하지 않는다.",
    "- 인접 문제가 논리 연결에 꼭 필요하다면 '비교의 한계'나 '더 확인할 조건'으로 명시한다.",
    "- 사회 압력이 선택한 쟁점에 직접 기여하지 않으면 원본 입력으로 보존하되 역사 비교의 중심 근거처럼 쓰지 않는다.",
    "- 사회 압력을 배경에서 한 번 언급한 것만으로 중심 인과관계에 사용했다고 처리하지 않는다.",
    "- 사용한 사회 압력이 중심 인과관계에서 어떤 역할을 하는지 본문에 보여준다.",
    "",
    "2차 충실성 검사",
    "- 선택된 axis의 사회 압력 연결이 실제 인과관계인지 확인한다.",
    "- 1차에서 보류했어야 할 요소를 다시 끌어오지 않는다.",
    "- 역사 비유의 비약을 긴 문장으로 숨기고 있지 않은지 확인한다.",
    "- 약한 연결이 발견되면 해당 요소를 중심 인과관계에서 제외한다.",
    "- 제외한 요소는 원본 입력으로 남길 수 있지만 세계사 렌즈 설명에는 억지로 사용하지 않는다.",
    "- 내용상의 한계 설명을 짧게 쓴다. 예: 이 조건은 강제 이주 사례와 닮은 행정 논리를 갖지만, 특정 역사적 폭력과 동일하다고 말해서는 안 된다.",
    "",
    "2차 비교 우선순위",
    "1. 중심 인과관계의 명확성",
    "2. 역사적 비교 기준의 명확성",
    "3. 사회 압력과 영향을 받는 집단의 충실한 사용",
    "4. 나머지 입력 요소의 사용률",
    "- 하위 기준을 만족하기 위해 상위 기준을 훼손하지 않는다.",
    "- 강한 결론을 보존하려고 정책 경로를 사후 발명하지 않는다.",
    "- 영향을 받는 집단은 계속 중심에 둔다. 왜 하필 이 집단이 영향을 받는지 보여준다.",
    "- usedElements는 인과사슬의 필수 노드일 때만 중심 서술에 사용한다.",
    "",
    "2차 사실성과 검증 가능성",
    "- 사건명, 제도명, 작품명, 사조명, 연도, 지역, 행위자를 확실히 아는 경우에만 구체명으로 쓴다.",
    "- 확실하지 않으면 특정명 대신 검증 가능한 넓은 역사적 패턴으로 쓴다.",
    "- 역사 사례와 문화 사례를 제시할 때는 시대, 지역, 행위자, 제도, 생활상, 문화 표현, 결과를 가능한 한 구분한다.",
    "- 확실히 아는 대표 키워드만 제시하고, 구체 출처가 필요하면 사용자가 확인할 검색어를 남긴다.",
    "- 검증 키워드는 출처 목록이 아니라 사용자가 직접 확인할 검색 출발점임을 전제로 쓴다.",
    "- 출처를 직접 확인하지 않은 상태에서 책 제목, 논문 제목, 정확한 문장 인용을 만들지 않는다.",
    "",
    "2차 매우 엄격한 레퍼런스 원칙",
    "- 확인하지 않은 참고문헌 번호, URL, 책 제목, 논문 제목, 기사 제목, 저자명, 쪽수, 직접 인용문을 절대 만들지 않는다.",
    "- 답변 끝에 [1], [2] 같은 가짜 각주나 참고문헌 목록을 붙이지 않는다.",
    "- 확실한 역사 사실과 비교 가설을 문장 안에서 구분한다. 예: '확인된 사례로는'과 '비교해볼 패턴으로는'을 혼동하지 않는다.",
    "- 고유명사의 기억이 불확실하면 쓰지 말고, 사용자가 검증할 수 있는 시대·지역·제도·키워드 조합으로 낮춰 말한다.",
    "- 각 사례에는 사용자가 바로 검색해 확인할 수 있는 검증 키워드를 자연스럽게 포함한다.",
    "",
    "2차 금지",
    "- JSON으로 답하지 않는다.",
    "- 분석 없이 역사 사례나 문화 사례 이름만 나열하지 않는다.",
    "- 새 기관 이름을 만드는 것으로 논리의 빈틈을 메우지 않는다.",
    "- 외부 조건, 정당화 언어, 공식 효용을 장식처럼 쓰지 않는다.",
    "- 모든 입력 요소를 강제로 통합하지 않는다.",
    "- 역사 사건이나 문화 표현을 소재처럼 소비하지 않는다.",
    "- '이 설정은 홀로코스트와 같다'처럼 거대한 폭력과 단순 동일시하지 않는다.",
    "- 확인되지 않은 사건명, 작품명, 사조명이나 연도를 지어내지 않는다.",
    "- 서로 다른 재정·보험·법률 체계를 설명 없이 통합하지 않는다.",
    "- 새로운 기관·기금·면허·급여체계로 bridge를 보강하지 않는다.",
    "- 생성 과정 설명이나 정렬 보고를 쓰지 않는다.",
    "- 금지 문구: 제공된 편집 브리프에 근거한다, 선택된 방향의 범위를 따른다, 업로드된 자료에 맞추었다, 원본 브리프와 정렬했다, source alignment, 사용자 입력에 충실하게 작성했다, 요청된 구조를 따랐다, 이 응답은 앞 단계 결과를 기반으로 한다.",
    "",
    "출력 지시",
    "- 자체검사 결과는 출력하지 않는다.",
    "- 분석은 충분히 했지만 표현은 압축했는가?",
    "- 같은 설명을 여러 구역에서 반복하지 않았는가?",
    "- 메타 문장이 들어가지 않았는가?",
    "- 입력 사회 압력을 인접 문제로 교체하지 않았는가?",
    "- usedElements는 실제 인과관계에 참여하는가?",
    "- 약한 연결을 장문으로 은폐하지 않았는가?",
    "- 새로운 중대한 가정을 추가하지 않았는가?",
    "- 약한 요소는 세계사 렌즈 본문의 중심에서 제외했는가?",
    "- 영향을 받는 집단이 계속 중심에 있는가?",
    "- 사건명·작품명·사조명·연도·제도명을 확실하지 않은데 구체명으로 쓰지 않았는가?",
    "- 검증할 검색 키워드나 비교 키워드를 남겼는가?",
    "지금부터 바로 사용자가 읽을 수 있는 한국어 해설을 작성한다.",
  ].join("\n");
}


export function getPromptMode({ search = "" } = {}) {
  const params = new URLSearchParams(search);
  if (params.get("apiAi") === "1") return "api";
  if (params.get("mockAi") === "1") return "mock";
  return "manual";
}

export function stripMarkdownCodeFence(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
}

function extractFirstJsonObject(text) {
  const source = stripMarkdownCodeFence(text);
  if (!source) return "";
  const start = source.indexOf("{");
  if (start < 0) return source.trim();
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }
    if (char === "\"") {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1).trim();
    }
  }
  return source.trim();
}

function normalizeJsonLikeText(text) {
  return String(text || "")
    .replace(/[\u201c\u201d\u201e\u2033]/g, "\"")
    .replace(/[\u2018\u2019\u201a\u2032]/g, "'");
}

function hasForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenField);
  return Object.keys(value).some((key) => FORBIDDEN_RESPONSE_FIELDS.has(key) || hasForbiddenField(value[key]));
}

export function parsePastedAiResponse(text) {
  const cleaned = normalizeJsonLikeText(extractFirstJsonObject(text));
  if (!cleaned) return { ok: false, errorType: "empty", message: "ChatGPT 응답을 먼저 붙여 넣어주세요." };
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, errorType: "parse", message: "JSON 형식으로 읽을 수 없습니다. ChatGPT가 반환한 JSON 전체를 복사했는지 확인해주세요." };
  }
  if (hasForbiddenField(parsed)) {
    return { ok: false, errorType: "forbidden-fields", message: "점수형 응답이 포함되어 있어 적용하지 않았습니다." };
  }
  if (parsed?.interpretationMode === "axis-finder") {
    const rawAxisValidation = validateAxisFinderResponse(parsed);
    if (!rawAxisValidation.ok) {
      return {
        ok: false,
        errorType: "schema",
        message: `역사적 쟁점 응답 구조에 필요한 항목이 없습니다. 전체 요청문을 다시 사용해 해석해주세요. 누락 예: ${rawAxisValidation.issues.slice(0, 3).join(" / ")}`,
        issues: rawAxisValidation.issues,
      };
    }
    const normalizedAxis = normalizeAxisFinderResponse(parsed);
    const normalizedAxisValidation = validateAxisFinderResponse(normalizedAxis);
    if (!normalizedAxisValidation.ok) {
      return {
        ok: false,
        errorType: "schema",
        message: `역사적 쟁점 응답 구조에 필요한 항목이 없습니다. 전체 요청문을 다시 사용해 해석해주세요. 누락 예: ${normalizedAxisValidation.issues.slice(0, 3).join(" / ")}`,
        issues: normalizedAxisValidation.issues,
      };
    }
    return { ok: true, value: normalizedAxis };
  }
  return {
    ok: false,
    errorType: "wrong-mode",
    message: "앱에는 1차 axis-finder JSON만 붙여 넣습니다. 선택한 쟁점의 2차 해설은 ChatGPT 창에서 바로 읽어주세요.",
  };
}

export const PROMPT_FORBIDDEN_PATTERNS = BAD_PROMPT_PATTERNS;
