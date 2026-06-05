import { NextResponse } from 'next/server';
import {
  buildLocalDashboardAiInsights,
  mergeGeminiInsights,
} from '@/lib/dashboardAi';
import { dataApi } from '@/lib/supabase';
import { waterStationApi } from '@/lib/waterStations';
import type { DashboardAiInsights } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function extractGeminiText(payload: unknown) {
  const candidates = (payload as { candidates?: unknown[] }).candidates;
  const first = candidates?.[0] as
    | { content?: { parts?: { text?: string }[] } }
    | undefined;
  return first?.content?.parts?.map((part) => part.text ?? '').join('').trim() ?? '';
}

function parseJsonObject(text: string) {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini response did not contain a JSON object');
  }
  return JSON.parse(cleaned.slice(start, end + 1)) as Partial<DashboardAiInsights>;
}

async function callGemini(fallback: DashboardAiInsights) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);
  try {
    const prompt = [
      '你是台灣大學校園水資源管理的資料分析助理。',
      '請根據下列 dashboard 統計，輸出繁體中文 JSON。',
      '你可以改寫摘要、異常偵測、月報解讀與維修優先順序，但不可發明不存在的地點或數字。',
      '輸出必須符合這個 schema：',
      JSON.stringify({
        headline: 'string',
        executiveSummary: 'string',
        anomalyScore: 'number 0-100',
        anomalies: [
          {
            title: 'string',
            severity: 'critical|warning|info',
            evidence: 'string',
            recommendation: 'string',
          },
        ],
        priorities: [
          {
            rank: 'number',
            target: 'string',
            type: 'risk_hotspot|water_station|stale_case',
            priority: 'P0|P1|P2',
            reason: 'string',
            action: 'string',
            ownerHint: 'string',
            slaHint: 'string',
          },
        ],
        monthlyNarrative: { title: 'string', body: 'string' },
        csvRows: [
          {
            priority: 'string',
            type: 'string',
            target: 'string',
            reason: 'string',
            recommendedAction: 'string',
            ownerHint: 'string',
            slaHint: 'string',
          },
        ],
      }),
      '以下是已由系統計算出的可信分析基底，請以它為準做管理報告化：',
      JSON.stringify(fallback),
    ].join('\n\n');

    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                '你只輸出 JSON，不輸出 Markdown。所有建議必須保守、可執行、以校園維修管理為中心。',
            },
          ],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 2400,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 180)}`);
    }

    const payload = await res.json();
    const text = extractGeminiText(payload);
    const parsed = parseJsonObject(text);
    return mergeGeminiInsights(fallback, parsed, GEMINI_MODEL);
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  try {
    const [reports, stations] = await Promise.all([
      dataApi.listReports(),
      waterStationApi.list(),
    ]);
    const fallback = buildLocalDashboardAiInsights({ reports, stations });

    try {
      return NextResponse.json(await callGemini(fallback));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gemini analysis failed';
      return NextResponse.json({
        ...fallback,
        aiError: message,
      } satisfies DashboardAiInsights);
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
