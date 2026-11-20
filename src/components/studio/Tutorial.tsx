import type { ReactNode } from "react";
import {
  AlertTriangle,
  BookOpen,
  HelpCircle,
  Lock,
  Settings,
  Sparkles,
  Wave,
  X,
} from "../ui/Icons";

type Props = {
  open: boolean;
  onClose: () => void;
};

function Step({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-card-sm border border-line bg-canvas p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-clay text-sm font-semibold text-clay-on">
          {num}
        </span>
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      </div>
      <div className="space-y-2.5 text-sm leading-relaxed text-ink-soft sm:pl-11">
        {children}
      </div>
    </div>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-oat px-1.5 py-0.5 align-baseline text-xs font-medium text-ink">
      {children}
    </span>
  );
}

export default function TutorialModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="animate-overlay fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-[#141413]/45 p-4 py-10 backdrop-blur-sm">
      <div
        className="animate-modal card-surface w-full max-w-2xl p-5 shadow-none sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-label="新手教程"
      >
        <div className="mb-2 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow flex items-center gap-1.5">
              <BookOpen size={13} /> 新手教程
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-semibold leading-snug text-ink">
              从零生成你的第一支教学视频
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-ghost shrink-0 rounded-full p-2"
            aria-label="关闭教程"
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-6 text-sm text-ink-muted">
          不需要懂任何编程，跟着下面的步骤点点鼠标就行。全程大约 10 分钟。
        </p>

        <div className="space-y-4">
          <Step num="0" title="先看看效果（不需要钥匙，30 秒）">
            <Sub>
              如果你还没见过生成出来的视频长什么样，先回到首页，点一下
              <Mark>
                <Wave size={12} />
                傅里叶级数
              </Mark>
              那张演示卡片——它会立刻播放一支完整的 AI 教学视频，播完还有小测验。
            </Sub>
            <Sub>看完觉得有意思？那就从下面的第 1 步开始，亲手生成一支。</Sub>
          </Step>

          <Step num="1" title="准备一把「AI 钥匙」（API Key）">
            <Sub>
              AI 模型需要一把钥匙才能替你干活，这把钥匙叫
              <Mark>API Key</Mark>
              。它是一串以 <span className="font-mono text-xs">sk-</span>{" "}
              开头的字符（例如
              <span className="font-mono text-xs">sk-123123123123123</span>
              这样的格式——注意这只是格式示例，不能直接用）。
            </Sub>
            <Sub>
              下面以最常用、最便宜的
              <Mark>DeepSeek</Mark>为例，其他家（通义千问、OpenAI
              等）步骤几乎一样：
            </Sub>
            <ol className="list-decimal space-y-1.5 pl-5 text-ink-muted">
              <li>
                用浏览器打开
                <span className="font-mono text-xs"> platform.deepseek.com</span>
                ，注册一个账号并登录；
              </li>
              <li>在「充值」里充几块钱（生成很多支视频都够用）；</li>
              <li>
                点左侧菜单的
                <Mark>API keys</Mark>
                ，再点「创建 API key」，随便起个名字；
              </li>
              <li>
                页面会显示一串以
                <span className="font-mono text-xs">sk-</span>
                开头的长字符——点「复制」保存好。它
                <span className="font-medium text-warning">只显示这一次</span>
                ，关掉就再也看不到了（丢了就重新建一个，不用担心）。
              </li>
            </ol>
          </Step>

          <Step num="2" title="把钥匙交给 LectureCast">
            <ol className="list-decimal space-y-1.5 pl-5 text-ink-muted">
              <li>
                回到本页面，点首页的
                <Mark>开始创作</Mark>
                进入工作台；
              </li>
              <li>
                点右上角的
                <Mark>
                  <Settings size={12} />
                  设置按钮
                </Mark>
                （上面写着「未配置模型」或模型名），打开设置窗口；
              </li>
              <li>
                在「供应商预设」下拉框里选
                <Mark>DeepSeek</Mark>
                ——下面的 Base URL（
                <span className="font-mono text-xs">
                  https://api.deepseek.com/v1
                </span>
                ）和模型名会<span className="text-ink">自动帮你填好</span>
                ，不用改；
              </li>
              <li>
                在「API Key」输入框里，把第 1 步复制的钥匙
                <span className="text-ink">粘贴</span>
                进去（可以点「显示」检查有没有贴完整）；
              </li>
              <li>
                点
                <Mark>测试连接</Mark>
                。看到绿色的「连接成功，延迟 xxx ms」就大功告成！设置会自动保存。
              </li>
            </ol>
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Lock size={12} />
              钥匙只保存在你自己电脑的浏览器里，我们不会上传或记录它。
            </p>
          </Step>

          <Step num="3" title="生成你的第一支视频">
            <ol className="list-decimal space-y-1.5 pl-5 text-ink-muted">
              <li>
                在最上面的输入框里，输入你想学（或想教给别人）的知识点。不知道写什么？试试这些：
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Mark>汉诺塔问题</Mark>
                  <Mark>什么是利息</Mark>
                  <Mark>贝叶斯定理</Mark>
                  <Mark>光合作用</Mark>
                </div>
              </li>
              <li>
                右边下拉框选
                <Mark>观众</Mark>
                ——这支视频讲给谁听（高中生、大学生、零基础…）；
              </li>
              <li>
                点
                <Mark>生成教学视频</Mark>
                。三个 AI 立刻开始分工：Planner 设计分镜 → Coder 编写动画代码 →
                Critic 检查画面并自动修正。
              </li>
              <li>
                左侧面板能看到三个智能体的实时进展，右侧的代码会像打字一样逐字出现。整个过程大约需要
                <span className="text-ink"> 3–10 分钟</span>
                （取决于模型速度），去倒杯水回来正好。
              </li>
              <li>
                完成后视频自动播放。看完还有
                <Mark>3 道课后测验</Mark>
                ，检查你有没有真的学会。
              </li>
            </ol>
          </Step>
        </div>

        <div className="card-inset mt-6 p-4 sm:p-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <HelpCircle size={15} /> 常见问题
          </h3>
          <div className="space-y-2.5 text-sm leading-relaxed text-ink-muted">
            <p>
              <span className="text-ink">测试连接失败？</span>
              检查钥匙是否复制完整（以 sk- 开头）；账户里是否有余额；或者换个网络再试。
            </p>
            <p>
              <span className="text-ink">提示「不允许浏览器直连」？</span>
              个别供应商限制网页直接调用——可以先换 DeepSeek 或 OpenAI，它们支持浏览器直连。
            </p>
            <p>
              <span className="text-ink">生成到一半出错了？</span>
              点「中止」再重新点「生成教学视频」即可；多试几次通常就好了。
            </p>
            <p>
              <span className="text-ink">想换个主题？</span>
              直接修改输入框里的知识点，再点一次生成。
            </p>
            <p>
              <span className="flex items-center gap-1.5 text-ink">
                <AlertTriangle size={13} /> 不想配置钥匙？
              </span>
              首页的演示案例永远免费免钥匙。
            </p>
          </div>
        </div>

        <button onClick={onClose} className="btn-primary mt-6 w-full">
          <Sparkles size={15} />
          我学会了，开始创作
        </button>
      </div>
    </div>
  );
}
