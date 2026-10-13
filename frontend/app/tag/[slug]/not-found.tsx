import RouteNotFound from '@/components/RouteNotFound';

export default function TagNotFound() {
  return (
    <RouteNotFound
      icon="🏷️"
      title="标签不存在"
      description="你访问的标签可能不存在，或链接地址不正确。"
    />
  );
}
