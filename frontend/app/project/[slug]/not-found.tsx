import RouteNotFound from '@/components/RouteNotFound';

export default function ProjectNotFound() {
  return (
    <RouteNotFound
      icon="📁"
      title="项目不存在"
      description="你访问的项目可能不存在，或链接地址已失效。"
    />
  );
}
