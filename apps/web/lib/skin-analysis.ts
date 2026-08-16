import {
  MockAcnePatternAssessmentProvider,
  MockSkinAnalysisProvider,
  OpenAiAcnePatternAssessmentProvider,
  YouCamSkinAnalysisProvider,
  type AcnePatternAssessmentProvider,
  type SkinAnalysisProvider
} from "@skincause/server-core";

export function createSkinAnalysisProvider(): SkinAnalysisProvider {
  const useMockOpenAi = process.env.OPENAI_MOCK_MODE === "true" || !process.env.OPENAI_API_KEY;
  const mockAcneAssessmentProvider = new MockAcnePatternAssessmentProvider();
  const acneAssessmentProvider: AcnePatternAssessmentProvider = useMockOpenAi
    ? mockAcneAssessmentProvider
    : {
        providerName: "openai" as const,
        async assess(input) {
          try {
            return await new OpenAiAcnePatternAssessmentProvider(
              process.env.OPENAI_API_KEY ?? "",
              process.env.OPENAI_ACNE_ASSESSMENT_MODEL ?? process.env.OPENAI_RECOMMENDATION_MODEL ?? "gpt-5.6-sol",
              process.env.OPENAI_API_BASE_URL
            ).assess(input);
          } catch {
            return mockAcneAssessmentProvider.assess(input);
          }
        }
      };
  if (process.env.YOUCAM_MOCK_MODE !== "false") {
    return new MockSkinAnalysisProvider(acneAssessmentProvider);
  }

  return new YouCamSkinAnalysisProvider(
    process.env.YOUCAM_API_KEY ?? "",
    process.env.YOUCAM_API_BASE_URL,
    process.env.YOUCAM_API_VERSION,
    acneAssessmentProvider
  );
}
