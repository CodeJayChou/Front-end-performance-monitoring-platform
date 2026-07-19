export function JsonViewer({ value }: { value: unknown }) {
  return <pre className="json-viewer"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}
