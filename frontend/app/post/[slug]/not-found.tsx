import RouteNotFound from '@/components/RouteNotFound';

export default function PostNotFound() {
  return (
    <RouteNotFound
      icon="🔍"
      title="文章不存在"
      description="你访问的文章可能已删除，或链接地址不正确。"
    />
  );
}
