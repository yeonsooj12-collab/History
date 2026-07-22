# Axis Finder 응답 계약

웹앱 호환 JSON을 요구받았을 때만 사용한다. 최상위 객체와 모든 하위 객체에 아래에 없는 필드를 추가하지 않는다.

```json
{
  "version": "1.0",
  "status": "success",
  "interpretationMode": "axis-finder",
  "overview": "세 쟁점을 함께 설명하는 짧은 개요",
  "axes": [
    {
      "id": "axis-1",
      "title": "짧은 제목",
      "coreInsight": "핵심 관찰",
      "centralContradiction": "중심 모순",
      "usedElements": ["사용한 입력 요소"],
      "deferredElements": ["이번 축에서 보류한 요소"],
      "bridge": "입력과 역사 사례를 잇는 연결 논리",
      "assumptions": ["추가 가정, 최대 2개"],
      "whyThisAxisMatters": "이 비교가 중요한 이유",
      "specificQuestion": "이 축에 특화된 질문 하나",
      "historicalCases": [
        {
          "title": "사례명",
          "period": "시대",
          "region": "지역",
          "context": "앞뒤 맥락",
          "insight": "비교에서 얻는 관찰",
          "verificationKeywords": ["사실 확인 검색어"]
        }
      ],
      "similarities": ["닮은 점"],
      "differences": ["결정적인 차이"],
      "humanBehaviorPattern": "반복되는 행동 또는 권력 패턴",
      "futureInsight": "현재나 미래를 읽는 통찰",
      "verificationKeywords": ["검색어 1", "검색어 2", "검색어 3"]
    }
  ],
  "unresolvedElements": ["어느 축에도 연결하지 않은 요소"],
  "editorNote": "비교의 범위와 한계를 알리는 짧은 메모"
}
```

## 제약

- `status`: `success`, `incomplete`, `fallback`, `error` 중 하나
- `interpretationMode`: 항상 `axis-finder`
- `axes`: 정확히 3개
- 각 축의 `historicalCases`: 1~2개
- 각 축의 `assumptions`: 최대 2개
- 각 축의 `similarities`, `differences`: 각각 1~2개
- 각 사례의 `verificationKeywords`: 1~5개
- 각 축의 `verificationKeywords`: 3~5개
- 모든 필드는 필수이며, 해당 내용이 없으면 빈 문자열 또는 빈 배열을 사용한다.
- 순수한 유효 JSON 객체 하나만 출력한다. 코드 펜스, 머리말, 각주, 참고문헌을 붙이지 않는다.
