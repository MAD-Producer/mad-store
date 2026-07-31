import type { AIReview, SubmissionInput } from "./types";

function extractJson(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 返回内容无效");
  return JSON.parse(match[0]) as Partial<AIReview>;
}

export async function reviewWithDeepSeek(input: SubmissionInput): Promise<AIReview | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(process.env.DEEPSEEK_API_URL || "https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "你是 MAD Store 的开源项目初审助手。只返回 JSON。检查仓库是否与 MAD/AMV 创作相关、描述是否清晰、是否存在明显恶意或版权风险。你只能提供建议，不能决定是否发布。字段：score(0-100), summary, reasons(string[]), securityConcerns(string[]), suggestedCategory, normalizedTags(string[])。",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const review = extractJson(data.choices?.[0]?.message?.content || "");
    return {
      score: Math.max(0, Math.min(100, Number(review.score) || 0)),
      summary: String(review.summary || "未提供摘要").slice(0, 500),
      reasons: Array.isArray(review.reasons) ? review.reasons.map(String).slice(0, 8) : [],
      securityConcerns: Array.isArray(review.securityConcerns)
        ? review.securityConcerns.map(String).slice(0, 8)
        : [],
      suggestedCategory: review.suggestedCategory ? String(review.suggestedCategory).slice(0, 40) : undefined,
      normalizedTags: Array.isArray(review.normalizedTags)
        ? review.normalizedTags.map(String).map((tag) => tag.slice(0, 24)).slice(0, 8)
        : [],
      reviewedAt: new Date().toISOString(),
      provider: "deepseek",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
