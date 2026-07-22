import { useState, type FormEvent } from "react";
import { AsyncPage, ButtonLoadingContent, ListSkeleton } from "../components/Loading";
import { EmptyState, ErrorState, formatDate, PageHeader } from "../components/Ui";
import { useDashboard } from "../state/DashboardContext";
import { useApiData } from "../state/useApiData";

export function SourceMapsPage() {
  const { client, filters, refreshKey, refresh } = useDashboard();
  const [release, setRelease] = useState(filters.release === "(none)" ? "" : filters.release);
  const [dist, setDist] = useState("");
  const [artifactName, setArtifactName] = useState("");
  const [sourceMap, setSourceMap] = useState<Record<string, unknown> | null>(null);
  const [fileName, setFileName] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const state = useApiData(
    (signal) => client ? client.sourceMaps(signal) : Promise.reject(new Error("尚未配置连接")),
    [client, refreshKey],
  );

  const chooseFile = async (file: File | undefined) => {
    setMessage(null);
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Record<string, unknown>;
      if (parsed.version !== 3) throw new Error("只支持 Source Map v3");
      setSourceMap(parsed);
      setFileName(file.name);
      const generatedFile = typeof parsed.file === "string" ? parsed.file : file.name.replace(/\.map$/i, "");
      setArtifactName(generatedFile.replace(/^\/+/, ""));
    } catch (error) {
      setSourceMap(null);
      setMessage(error instanceof Error ? error.message : "无法解析 Source Map");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!client || !sourceMap) return;
    setPendingAction("upload");
    setMessage(null);
    try {
      await client.uploadSourceMap({ release, dist, artifactName, sourceMap });
      setMessage("Source Map 已上传；后续进入 Processor 的错误会自动尝试还原。");
      setSourceMap(null);
      setFileName("");
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "上传失败");
    } finally {
      setPendingAction(null);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!client || !window.confirm(`确定删除 Source Map “${name}”吗？`)) return;
    setPendingAction(`delete:${id}`);
    try {
      await client.deleteSourceMap(id);
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <AsyncPage refreshing={state.refreshing} error={state.data ? state.error : null}>
      <PageHeader eyebrow="SOURCE MAPS" title="源码映射" description="按 Release 上传构建产物的 .map 文件，让压缩堆栈还原到源码文件、函数和行列。" />
      <div className="content-grid source-map-layout">
        <section className="panel">
          <div className="panel-heading"><div><span>UPLOAD</span><h2>上传 Source Map</h2></div></div>
          <form className="source-map-form" onSubmit={submit}>
            <label>Release<input required placeholder="web@1.2.3" value={release} onChange={(event) => setRelease(event.target.value)} /></label>
            <label>Dist（可选）<input placeholder="例如 build-42" value={dist} onChange={(event) => setDist(event.target.value)} /></label>
            <label>生成文件路径<input required placeholder="assets/index.js" value={artifactName} onChange={(event) => setArtifactName(event.target.value)} /></label>
            <label className="source-map-file">Source Map 文件<input required type="file" accept=".map,application/json" onChange={(event) => void chooseFile(event.target.files?.[0])} /><span>{fileName || "选择 .map 文件（最大 15MB 请求体）"}</span></label>
            {message ? <p className="source-map-message" role="status">{message}</p> : null}
            <button className="primary-button" type="submit" disabled={pendingAction !== null || !sourceMap} aria-busy={pendingAction === "upload"}><ButtonLoadingContent loading={pendingAction === "upload"} loadingLabel="正在上传…">上传并启用</ButtonLoadingContent></button>
          </form>
        </section>
        <section className="panel">
          <div className="panel-heading"><div><span>ARTIFACTS</span><h2>已上传映射</h2></div></div>
          {state.loading ? <ListSkeleton /> : state.error && !state.data ? <ErrorState error={state.error} onRetry={refresh} /> : state.data?.length ? <div className="source-map-list">{state.data.map((item) => <article key={item.id}><div><strong>{item.artifactName}</strong><span>{item.release}{item.dist ? ` · ${item.dist}` : ""}</span></div><div><span>{item.sourceCount} 个源文件</span><span>更新于 {formatDate(item.updatedAt)}</span></div><code>{item.contentHash.slice(0, 16)}</code><button type="button" disabled={pendingAction !== null} aria-busy={pendingAction === `delete:${item.id}`} onClick={() => void remove(item.id, item.artifactName)}><ButtonLoadingContent loading={pendingAction === `delete:${item.id}`} loadingLabel="删除中…">删除</ButtonLoadingContent></button></article>)}</div> : <EmptyState title="还没有 Source Map" description="上传后，新处理的同 Release 错误会自动尝试源码还原。" />}
        </section>
      </div>
    </AsyncPage>
  );
}
