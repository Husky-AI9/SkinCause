import {
  MockSkinAnalysisProvider,
  YouCamSkinAnalysisProvider,
  type SkinAnalysisProvider
} from "@skincause/server-core";

export function createSkinAnalysisProvider(): SkinAnalysisProvider {
  if (process.env.YOUCAM_MOCK_MODE !== "false") {
    return new MockSkinAnalysisProvider();
  }

  return new YouCamSkinAnalysisProvider(
    process.env.YOUCAM_API_KEY ?? "",
    process.env.YOUCAM_API_BASE_URL,
    process.env.YOUCAM_API_VERSION
  );
}
