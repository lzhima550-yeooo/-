import { LoadingState } from './AsyncStates'

export function RouteLoadingFallback() {
  return (
    <div className="px-4 py-6 lg:px-6">
      <LoadingState title="页面加载中" description="正在加载模块资源..." />
    </div>
  )
}
