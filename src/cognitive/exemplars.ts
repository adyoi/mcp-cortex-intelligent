import * as pipeline from "../knowledge/pipeline.js";

export async function ingestExemplar(taskType: string, language: string, title: string, content: string, outcome: string) {
  const doc = await pipeline.ingestText(content, title, { source: "exemplar", contentType: "text", metadata: { task_type: taskType, language, outcome } });
  return doc;
}

export async function retrieveExemplars(task: string, topK = 5) {
  return pipeline.searchDocs(task, topK, 0.0, { source: "exemplar" });
}
