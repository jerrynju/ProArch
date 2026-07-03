import { useRef, type ReactNode } from 'react';
import { M3 } from '../theme';
import { NOTEBOOK_FILES, WORKSPACE_EVOLUTION, useSession, useStore } from '../store';
import { ComingSoonTag, disabledStyle, IconButton, Scrim, Switch } from '../components/widgets';
import {
  IcAntenna, IcBack, IcChevronRight, IcDownload, IcFile, IcFilePlus, IcFolder, IcFolderPlus, IcGear,
  IcLogout, IcMoon, IcPackage, IcPlus, IcSparkle, IcStar, IcSun, IcUpload, IcUser, IcWrench,
} from '../components/icons';

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '16px 18px', borderBottom: `1px solid ${M3.surfaceContainer}` }}>
      <IconButton size={30} onClick={onBack} testId="drawer-back">
        <IcBack size={18} color={M3.textSecondary} />
      </IconButton>
      <span style={{ fontSize: 15, fontWeight: 600, color: M3.text }}>{title}</span>
    </div>
  );
}

function Row({ label, right, onClick, disabled }: { label: string; right?: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px',
        cursor: disabled ? 'not-allowed' : onClick ? 'pointer' : 'default',
        ...(disabled ? disabledStyle : null),
      }}
    >
      <span style={{ fontSize: 13.5, color: M3.text }}>{label}</span>
      {right ?? (disabled ? <ComingSoonTag /> : <IcChevronRight size={16} color={M3.textTertiary} />)}
    </div>
  );
}

function AccountView() {
  const { isLoggedIn, set } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="账户" onBack={() => set({ drawerView: 'main' })} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
        {isLoggedIn ? (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '8px 0 20px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 32, background: M3.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 600 }}>王</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: M3.text, marginTop: 12 }}>王工程师</div>
              <div style={{ fontSize: 12.5, color: M3.textTertiary, marginTop: 2 }}>wang@structuremail.com</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, borderTop: `1px solid ${M3.surfaceContainer}`, paddingTop: 8 }}>
              <Row label="通知设置" disabled />
              <Row label="语言 · 简体中文" disabled />
              <Row label="订阅计划 · 专业版" disabled />
            </div>
            <div
              onClick={() => set({ isLoggedIn: false, drawerView: 'main' })}
              style={{ marginTop: 20, textAlign: 'center', padding: 12, borderRadius: 14, background: M3.errorContainer, color: M3.onErrorContainer, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
            >
              退出登录(演示)
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 4px' }}>
            <div style={{ width: 56, height: 56, borderRadius: 28, background: M3.surfaceContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', color: M3.textTertiary, margin: '0 auto 16px' }}>
              <IcUser size={24} />
            </div>
            <div style={{ fontSize: 14, color: M3.textSecondary, marginBottom: 18 }}>登录以同步项目与偏好设置</div>
            <div onClick={() => set({ drawerView: 'login' })} style={{ display: 'inline-block', padding: '11px 28px', borderRadius: 14, background: M3.primary, color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
              登录
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FavoritesView() {
  const { set, openNotebook } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="收藏" onBack={() => set({ drawerView: 'main' })} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px' }}>
        {NOTEBOOK_FILES.map((f) => (
          <div key={f.path} onClick={() => openNotebook(f.path)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', cursor: 'pointer' }}>
            <IcStar size={16} />
            <span style={{ fontSize: 13.5, color: M3.text, flex: 1 }}>{f.fileName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProjectView() {
  const { set, openNotebook, createBlankNotebook, importNotebookRaw } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const templates = [
    { name: '悬臂梁挠度分析', sub: '结构力学模板', bg: 'linear-gradient(135deg,#EADDFF,#D0BCFF)', path: NOTEBOOK_FILES[0].path },
    { name: 'X 波段链路预算', sub: 'rf 域包模板', bg: 'linear-gradient(135deg,#C8E6C9,#8FCB93)', path: NOTEBOOK_FILES[1].path },
    { name: '应力校核清单', sub: '通用校核模板', bg: 'linear-gradient(135deg,#FFD8E4,#F3A6BE)', path: NOTEBOOK_FILES[4].path },
    { name: 'RC 电路暂态响应', sub: 'circuit 域包模板', bg: 'linear-gradient(135deg,#FFE0B2,#F3C078)', path: NOTEBOOK_FILES[3].path },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="新建项目" onBack={() => set({ drawerView: 'main' })} />
      <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          onClick={() => createBlankNotebook()}
          data-testid="new-blank-notebook"
          style={{ display: 'flex', alignItems: 'center', gap: 14, background: M3.surfaceLow, borderRadius: 16, padding: 16, cursor: 'pointer' }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, background: M3.primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: M3.onPrimaryContainer }}>
            <IcPlus size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: M3.text }}>新建空白项目</div>
            <div style={{ fontSize: 12, color: M3.textTertiary, marginTop: 2 }}>从一张空白 .pro.md 笔记本开始</div>
          </div>
        </div>
        <div
          onClick={() => fileInput.current?.click()}
          data-testid="import-notebook"
          style={{ display: 'flex', alignItems: 'center', gap: 14, background: M3.surfaceLow, borderRadius: 16, padding: 16, cursor: 'pointer' }}
        >
          <div style={{ width: 42, height: 42, borderRadius: 12, background: M3.secondaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: M3.onSecondaryContainer }}>
            <IcUpload size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: M3.text }}>导入项目</div>
            <div style={{ fontSize: 12, color: M3.textTertiary, marginTop: 2 }}>选择本地 .pro.md 文件导入</div>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".md,.markdown,text/markdown"
            style={{ display: 'none' }}
            onClick={(e) => e.stopPropagation()}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) importNotebookRaw(f.name, await f.text());
            }}
          />
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '10px 2px 2px' }}>从模板新建</div>
        {templates.map((t) => (
          <div
            key={t.name}
            onClick={() => openNotebook(t.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, background: '#FFFFFF', border: `1px solid ${M3.outline}`,
              borderRadius: 16, padding: 14, cursor: 'pointer',
            }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: t.bg, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: M3.text }}>{t.name}</div>
              <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 1 }}>{t.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsView() {
  const { dark, autoAlert, set } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="设置" onBack={() => set({ drawerView: 'main' })} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 20px' }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '12px 2px 6px' }}>外观</div>
        <Row label="深色主题" right={<Switch on={dark} onToggle={() => set({ dark: !dark })} />} />
        <Row label="紧凑密度" disabled />
        <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '16px 2px 6px' }}>通知</div>
        <Row label="校核结果提醒" right={<Switch on={autoAlert} onToggle={() => set({ autoAlert: !autoAlert })} />} />
        <Row label="语言 · 简体中文" disabled />
        <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '16px 2px 6px' }}>账户</div>
        <Row label="账户与订阅" onClick={() => set({ drawerView: 'account' })} />
        <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '16px 2px 6px' }}>关于</div>
        <Row label="版本" right={<span style={{ fontSize: 12.5, color: M3.textTertiary }}>ProArch 0.1.0</span>} />
      </div>
    </div>
  );
}

function LoginView() {
  const { set } = useStore();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SubHeader title="登录" onBack={() => set({ drawerView: 'main' })} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 22px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: M3.primaryContainer, display: 'flex', alignItems: 'center', justifyContent: 'center', color: M3.primary, margin: '0 auto 20px' }}>
          <IcUser size={26} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, marginBottom: 6 }}>邮箱</div>
        <div style={{ background: M3.surfaceContainer, borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: M3.text, marginBottom: 14 }}>wang@structuremail.com</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: M3.textTertiary, marginBottom: 6 }}>密码</div>
        <div style={{ background: M3.surfaceContainer, borderRadius: 12, padding: '12px 14px', fontSize: 13.5, color: M3.text, marginBottom: 20 }}>••••••••</div>
        <div onClick={() => set({ isLoggedIn: true, drawerView: 'account' })} style={{ textAlign: 'center', padding: 13, borderRadius: 14, background: M3.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          登录(演示)
        </div>
        <div style={{ textAlign: 'center', fontSize: 12.5, marginTop: 16, ...disabledStyle }}>没有账户?注册</div>
      </div>
    </div>
  );
}

interface TreeFolder {
  key: string; // matches NotebookFile.project — folder contents derive from the registry
  name: string;
  indent?: boolean;
  subfolders?: TreeFolder[];
}

const TREE: TreeFolder[] = [
  {
    key: 'stru', name: '结构分析',
    subfolders: [
      { key: 'beam', name: '梁与桁架', indent: true },
      { key: 'column', name: '柱与稳定性', indent: true },
    ],
  },
  { key: 'rfcomm', name: '射频通信' },
  { key: 'circuit', name: '电路仿真' },
];

function FolderRow({ folder }: { folder: TreeFolder }) {
  const { folderOpen, set, openNotebook, notebookPath, createBlankNotebook } = useStore();
  const files = useStore((s) => s.files).filter((f) => f.project === folder.key);
  const open = folderOpen[folder.key];
  const pad = folder.indent ? '10px 18px 10px 44px' : '11px 18px';
  return (
    <>
      <div
        onClick={() => set({ folderOpen: { ...folderOpen, [folder.key]: !open } })}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: pad, cursor: 'pointer' }}
        data-testid={`folder-${folder.key}`}
      >
        <div style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .15s', display: 'flex' }}>
          <IcChevronRight size={folder.indent ? 13 : 14} color={M3.textTertiary} strokeWidth={2.2} />
        </div>
        <IcFolder size={folder.indent ? 17 : 18} color={M3.primary} />
        <span style={{ fontSize: folder.indent ? 13.5 : 14, color: M3.text, flex: 1 }}>{folder.name}</span>
        {!folder.indent && (
          <IconButton
            size={24}
            onClick={(e) => { e.stopPropagation(); createBlankNotebook(folder.key); }}
            testId={`folder-add-${folder.key}`}
          >
            <IcPlus size={14} color={M3.textTertiary} />
          </IconButton>
        )}
      </div>
      {open && (
        <>
          {files.map((f) => {
            const active = f.path === notebookPath;
            return (
              <div
                key={f.path}
                onClick={() => openNotebook(f.path)}
                data-testid={`nbfile-${f.path.split('/').pop()}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px 9px 70px',
                  cursor: 'pointer',
                  background: active ? M3.primaryContainer : undefined,
                  borderRadius: active ? '0 20px 20px 0' : undefined,
                  marginRight: active ? 8 : undefined,
                }}
              >
                <IcFile size={16} color={active ? M3.onPrimaryContainer : M3.textTertiary} />
                <span style={{ fontSize: 13, color: active ? M3.onPrimaryContainer : M3.textSecondary, fontWeight: active ? 600 : 400, flex: 1 }}>{f.fileName}</span>
              </div>
            );
          })}
          {folder.subfolders?.map((sf) => <FolderRow key={sf.key} folder={sf} />)}
        </>
      )}
    </>
  );
}

/**
 * Domain packages gate which functions a notebook can call (spec: `fspl` is
 * invisible until a notebook declares `packages: [rf]`). This section is the
 * registry's UI: load any registered package into the *currently open*
 * notebook — dependencies attach transitively (mech pulls units), and the
 * workspace's self-evolved `learned` library is listed alongside, since it
 * behaves exactly like a package the user authored by working.
 */
function PackageLoaderSection() {
  const { session } = useSession();
  const loadPackage = useStore((s) => s.loadPackage);
  const attached = new Set(session.attachedPackages().map((p) => p.name));
  const learned = [...WORKSPACE_EVOLUTION.learned.values()];

  return (
    <div style={{ padding: '10px 18px 4px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', marginBottom: 8 }}>
        领域包 · 当前笔记本
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {session.availablePackages().map((pkg) => {
          const loaded = attached.has(pkg.name);
          const deps = (pkg.requires ?? []).map((r) => r.name);
          const usage = [...pkg.functions.keys(), ...Object.keys(pkg.constants ?? {})]
            .reduce((n, sym) => n + (WORKSPACE_EVOLUTION.fnUsage.get(sym) ?? 0), 0);
          return (
            <div
              key={pkg.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, background: M3.surfaceLow,
                borderRadius: 12, padding: '9px 10px 9px 12px',
              }}
              data-testid={`pkg-loader-${pkg.name}`}
            >
              <span style={{ display: 'flex', color: M3.primary }}>
                {pkg.name === 'rf' ? <IcAntenna size={16} /> : pkg.name === 'mech' ? <IcWrench size={16} /> : <IcPackage size={16} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: M3.text }}>{pkg.name}</span>
                  <span style={{ fontSize: 10, color: M3.textFaint }}>v{pkg.version}</span>
                  {usage > 0 && <span style={{ fontSize: 10, color: M3.textFaint }}>· 引用 {usage}</span>}
                </div>
                <div style={{ fontSize: 10.5, color: M3.textTertiary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deps.length > 0 ? `依赖 ${deps.join('、')} · ` : ''}
                  {[...pkg.functions.keys()].slice(0, 3).join(' · ')}
                </div>
              </div>
              {loaded ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: M3.onSuccessContainer, background: M3.successContainer, padding: '5px 10px', borderRadius: 10 }}>
                  已加载
                </span>
              ) : (
                <div
                  onClick={() => loadPackage(pkg.name)}
                  data-testid={`pkg-load-btn-${pkg.name}`}
                  style={{ fontSize: 11, fontWeight: 600, color: M3.onPrimaryContainer, background: M3.primaryContainer, padding: '5px 10px', borderRadius: 10, cursor: 'pointer' }}
                >
                  加载
                </div>
              )}
            </div>
          );
        })}

        <div style={{ background: M3.surfaceLow, borderRadius: 12, padding: '9px 12px' }} data-testid="pkg-learned">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ display: 'flex', color: M3.primary, alignSelf: 'center' }}><IcSparkle size={14} /></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: M3.text }}>learned</span>
            <span style={{ fontSize: 10, color: M3.textFaint }}>v{WORKSPACE_EVOLUTION.version} · 自进化函数库</span>
          </div>
          {learned.length === 0 ? (
            <div style={{ fontSize: 10.5, color: M3.textFaint, marginTop: 3 }}>
              尚无沉淀函数 — 在符号检查器中把闭包"沉淀"到这里,即可跨笔记本复用
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
              {learned.map((fn) => (
                <div key={fn.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }} data-testid={`learned-fn-${fn.name}`}>
                  <code style={{ fontFamily: "ui-monospace,Consolas,monospace", color: M3.onPrimaryContainer, background: M3.primaryContainer, borderRadius: 5, padding: '1px 6px' }}>{fn.name}</code>
                  <span style={{ color: M3.textFaint, fontSize: 10.5 }}>引用 {fn.usage} 次</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MainView() {
  const { isLoggedIn, dark, showUpdateInfo, set, files } = useStore();
  const hasLocal = files.some((f) => f.project === 'local');
  const recent = [...files.filter((f) => f.recency === '刚刚').reverse(), ...files.filter((f) => f.recency !== '刚刚')].slice(0, 5);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <div onClick={() => set({ drawerView: 'account' })} style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${M3.surfaceContainer}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} data-testid="drawer-account">
        <div style={{ width: 44, height: 44, borderRadius: 22, background: M3.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600, flexShrink: 0 }}>王</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: M3.text }}>{isLoggedIn ? '王工程师' : '未登录'}</div>
          <div style={{ fontSize: 11.5, color: M3.textTertiary, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isLoggedIn ? 'wang@structuremail.com' : '登录以同步项目'}
          </div>
        </div>
        <IconButton size={32} onClick={(e) => { e.stopPropagation(); set({ isLoggedIn: !isLoggedIn }); }}>
          <IcLogout size={17} color={M3.primary} />
        </IconButton>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '14px 18px' }}>
        <div onClick={() => set({ drawerView: 'newProject' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 4px', borderRadius: 12, background: M3.primaryContainer, color: M3.onPrimaryContainer, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} data-testid="drawer-new-project">
          <IcPlus size={16} />
          <span>新建项目</span>
        </div>
        <div onClick={() => set({ drawerView: 'favorites' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 4px', borderRadius: 12, background: M3.surfaceContainer, color: M3.textSecondary, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
          <IcStar size={16} />
          <span>收藏列表</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px 4px 18px' }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em' }}>项目</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <IconButton size={26} onClick={() => useStore.getState().createBlankNotebook()} testId="tree-new-folder">
            <IcFolderPlus size={15} color={M3.textTertiary} />
          </IconButton>
          <IconButton size={26} onClick={() => set({ drawerView: 'newProject' })} testId="tree-new-file">
            <IcFilePlus size={15} color={M3.textTertiary} />
          </IconButton>
        </div>
      </div>

      {TREE.map((f) => <FolderRow key={f.key} folder={f} />)}
      {hasLocal && <FolderRow folder={{ key: 'local', name: '我的项目' }} />}

      <div style={{ fontSize: 11.5, fontWeight: 600, color: M3.textTertiary, letterSpacing: '.04em', padding: '16px 18px 4px' }}>最近打开</div>
      {recent.map((f) => (
        <div
          key={f.path}
          onClick={() => useStore.getState().openNotebook(f.path)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px', cursor: 'pointer' }}
        >
          <IcFile size={16} color={M3.textTertiary} />
          <span style={{ fontSize: 13, color: M3.textSecondary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.fileName}</span>
          <span style={{ fontSize: 11, color: M3.textFaint, flexShrink: 0 }}>{f.recency}</span>
        </div>
      ))}

      <div style={{ flex: 1 }} />
      <PackageLoaderSection />
      <div style={{ borderTop: `1px solid ${M3.surfaceContainer}`, display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px 18px', marginTop: 12 }}>
        <div onClick={() => set({ drawerView: 'settings' })} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} data-testid="drawer-settings">
          <IcGear size={20} color={M3.textSecondary} />
          <span style={{ fontSize: 14, color: M3.text }}>设置</span>
        </div>
        <IconButton size={32} onClick={() => set({ dark: !dark })} style={{ background: M3.surfaceContainer }} testId="theme-toggle">
          {dark ? <IcSun size={16} color={M3.textSecondary} /> : <IcMoon size={16} color={M3.textSecondary} />}
        </IconButton>
        <IconButton size={32} onClick={() => set({ showUpdateInfo: !showUpdateInfo })} style={{ background: M3.primaryContainer, position: 'relative' }}>
          <IcDownload size={16} color={M3.primary} />
          <div style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 4, background: M3.error }} />
        </IconButton>
      </div>
      {showUpdateInfo && (
        <div style={{ margin: '0 18px 16px', padding: '12px 14px', background: M3.primaryContainer, borderRadius: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: M3.onPrimaryContainer }}>发现新版本 0.2.0</div>
          <div style={{ fontSize: 11, color: '#4A3B6B', marginTop: 3, lineHeight: 1.5 }}>新增自动化智能体与批量校核功能</div>
        </div>
      )}
    </div>
  );
}

export function AppDrawer() {
  const { drawerOpen, drawerView, set } = useStore();
  return (
    <>
      <Scrim open={drawerOpen} onClick={() => set({ drawerOpen: false })} />
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 46 }}>
        <div
          data-testid="drawer"
          style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: 300, background: '#FFFFFF',
            boxShadow: drawerOpen ? '2px 0 16px rgba(0,0,0,.2)' : 'none',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
            pointerEvents: drawerOpen ? 'auto' : 'none',
            transform: drawerOpen ? 'translateX(0)' : 'translateX(-105%)',
            visibility: drawerOpen ? 'visible' : 'hidden',
            transition: 'transform .22s ease, visibility .22s',
          }}
        >
          {drawerView === 'main' && <MainView />}
          {drawerView === 'account' && <AccountView />}
          {drawerView === 'favorites' && <FavoritesView />}
          {drawerView === 'newProject' && <NewProjectView />}
          {drawerView === 'settings' && <SettingsView />}
          {drawerView === 'login' && <LoginView />}
        </div>
      </div>
    </>
  );
}
