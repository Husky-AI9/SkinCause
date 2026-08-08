import {
  MockAcnePatternAssessmentProvider,
  MockSkinAnalysisProvider,
  OpenAiAcnePatternAssessmentProvider,
  YouCamSkinAnalysisProvider,
  type SkinAnalysisProvider
} from "@skincause/server-core";

export function createSkinAnalysisProvider(): SkinAnalysisProvider {
  const acneAssessmentProvider = process.env.OPENAI_MOCK_MODE !== "false"
    ? new MockAcnePatternAssessmentProvider()
    : new OpenAiAcnePatternAssessmentProvider(
        process.env.OPENAI_API_KEY ?? "",
        process.env.OPENAI_ACNE_ASSESSMENT_MODEL ?? process.env.OPENAI_RECOMMENDATION_MODEL ?? "gpt-5.6-sol",
        process.env.OPENAI_API_BASE_URL
      );
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
