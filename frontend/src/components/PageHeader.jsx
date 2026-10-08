// 三个主页面统一的左上角大标题：样式 / 字号 / 间距保持一致
export default function PageHeader({ title, right }) {
  return (
    <div className="flex items-center justify-between px-4 pt-5 pb-4">
      <h1 className="text-xl font-semibold text-primary">{title}</h1>
      {right || null}
    </div>
  )
}
