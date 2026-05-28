type LandingHero = {
  headline?: unknown
  subheadline?: unknown
  ctaPrimary?: unknown
  ctaSecondary?: unknown
}

type LandingFeature = {
  title?: unknown
  description?: unknown
  icon?: unknown
}

type LandingPricingTier = {
  tier?: unknown
  price?: unknown
  features?: unknown
  cta?: unknown
}

type LandingFaq = {
  question?: unknown
  answer?: unknown
}

type LandingPageCopy = {
  hero?: LandingHero
  features?: LandingFeature[]
  socialProof?: unknown
  pricing?: LandingPricingTier[]
  faq?: LandingFaq[]
}

type SeoMetadata = {
  title?: unknown
  description?: unknown
  keywords?: unknown
}

const FALLBACK_COLORS = ['#0f172a', '#2563eb', '#14b8a6']
const LANDING_PLACEHOLDER_PATTERNS = [
  /landing page pending/i,
  /component not found/i,
]

// Runtime safety shim injected into every landing-page iframe.
//
// Generated landing components routinely reference libraries that AREN'T
// loaded in the preview runtime — most commonly `LucideIcons.Shield`,
// `<Shield />`, `motion.div`, framer-motion, Next.js <Link>/<Image>,
// clsx/cn. Without this shim those references crash the page with
// "X is not defined" or "Cannot read properties of undefined (reading 'Y')".
//
// The shim runs BEFORE the user component code and:
//   • Defines a generic inline-SVG icon component (`GenericIcon`).
//   • Exposes every common icon namespace (LucideIcons, Heroicons, etc.) as
//     a Proxy that returns GenericIcon for any property access.
//   • Populates ~150 common PascalCase icon names as globals so bare
//     references like `<Shield />` also resolve to GenericIcon.
//   • Shims `motion.*` (framer-motion) to render the underlying tag with
//     non-animation props only, and `AnimatePresence` to pass children
//     through.
//   • Shims `NextLink` / `NextImage` to plain <a> and <img>.
//   • Provides `clsx` / `cn` / `classNames` as simple class joiners.
//
// This is defense-in-depth: the agent prompt forbids these libraries, but
// the LLM occasionally drifts (especially in edit mode). The shim ensures
// drift never produces a broken render.
export const LANDING_RUNTIME_SHIM = `<script>
(function () {
  if (typeof window === 'undefined' || typeof React === 'undefined') return;

  function GenericIcon(props) {
    var p = props || {};
    var size = p.size || p.width || 20;
    var attrs = {
      xmlns: 'http://www.w3.org/2000/svg',
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: p.color || 'currentColor',
      strokeWidth: p.strokeWidth || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: p.className,
      style: p.style,
      'aria-hidden': 'true'
    };
    return React.createElement('svg', attrs,
      React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
      React.createElement('path', { d: 'M9 12l2 2 4-4' })
    );
  }
  GenericIcon.displayName = 'GenericIcon';

  var iconProxy = new Proxy({}, {
    get: function (_, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === '$$typeof' || prop === 'prototype' || prop === 'then' || prop === 'default' || prop === '__esModule') return undefined;
      return GenericIcon;
    }
  });

  var ICON_NAMESPACES = ['LucideIcons','Lucide','LucideReact','lucideReact','Icons','HeroIcons','Heroicons','HiIcons','FontAwesome','FaIcons','FAIcons','FontAwesomeIcon','RemixIcons','RIcons','BoxIcons','BiIcons','Feather','FeatherIcons','FiIcons','Tabler','TablerIcons','TbIcons','PhosphorIcons','PhIcons','MaterialIcons','MdIcons','IoIcons','Ionicons','GiIcons','GameIcons','SiIcons','SimpleIcons'];
  ICON_NAMESPACES.forEach(function (name) {
    try { if (typeof window[name] === 'undefined') window[name] = iconProxy; } catch (e) {}
  });

  var COMMON_ICONS = ['Shield','ShieldCheck','ShieldAlert','User','Users','UserPlus','UserMinus','UserCheck','UserX','Check','CheckCircle','CheckCircle2','CheckSquare','X','XCircle','XSquare','ArrowRight','ArrowLeft','ArrowUp','ArrowDown','ArrowUpRight','ArrowDownRight','ChevronDown','ChevronUp','ChevronRight','ChevronLeft','ChevronsRight','ChevronsLeft','ChevronsUp','ChevronsDown','Star','Heart','Mail','Phone','Globe','Globe2','Zap','Sparkles','Sparkle','Rocket','Lock','Unlock','Key','Settings','Settings2','Search','Menu','Plus','PlusCircle','Minus','MinusCircle','Bell','BellOff','Calendar','CalendarDays','Clock','Clock3','Clock9','Home','MessageCircle','MessageSquare','Smile','Frown','ThumbsUp','ThumbsDown','Trash','Trash2','Upload','Download','Eye','EyeOff','Edit','Edit2','Edit3','Pen','PenTool','Pencil','Camera','Image','ImageIcon','Video','Play','PlayCircle','Pause','PauseCircle','Volume','Volume1','Volume2','VolumeX','Mic','MicOff','Filter','FilterX','Briefcase','Building','Building2','Code','Code2','Database','Layers','Layers2','Layers3','Server','Box','Boxes','Package','Package2','PackageOpen','ShoppingBag','ShoppingCart','CreditCard','DollarSign','Euro','PoundSterling','TrendingUp','TrendingDown','BarChart','BarChart2','BarChart3','BarChart4','PieChart','LineChart','Activity','Award','Gift','Send','SendHorizonal','Share','Share2','Link','Link2','LinkIcon','ExternalLink','Copy','CopyCheck','Clipboard','ClipboardCheck','ClipboardCopy','Save','RefreshCw','RefreshCcw','RotateCcw','RotateCw','Power','PowerOff','LogIn','LogOut','Wifi','WifiOff','Cloud','CloudOff','CloudRain','CloudSnow','Sun','SunMedium','Moon','Stars','Cpu','HardDrive','Smartphone','Tablet','Laptop','Monitor','MonitorSmartphone','Headphones','Keyboard','Mouse','MousePointer','Battery','BatteryCharging','BatteryFull','BatteryLow','MapPin','Map','Navigation','Navigation2','Compass','Anchor','Truck','Plane','Car','Ship','Bus','Bike','Train','Coffee','Pizza','Apple','UtensilsCrossed','ChefHat','BookOpen','Book','BookmarkPlus','Bookmark','FileText','File','FilePlus','FileMinus','FileCheck','FileX','FileCode','FileSearch','Folder','FolderOpen','FolderPlus','FolderMinus','Archive','Inbox','Trophy','Medal','Crown','Flag','Flame','Wand','Wand2','Lightbulb','Grid','Grid2X2','Grid3X3','List','ListChecks','LayoutGrid','LayoutList','LayoutDashboard','LayoutTemplate','SidebarOpen','SidebarClose','PanelLeft','PanelRight','PanelTop','PanelBottom','MoreHorizontal','MoreVertical','SortAsc','SortDesc','Loader','Loader2','LoaderCircle','Hourglass','Timer','AlarmClock','Watch','Hash','AtSign','Percent','Tag','Tags','Pin','PinOff','Paperclip','Repeat','Repeat1','Shuffle','SkipBack','SkipForward','Square','Circle','CircleDot','Triangle','Diamond','Hexagon','Octagon','Pentagon','Info','AlertCircle','AlertTriangle','AlertOctagon','HelpCircle','LifeBuoy','Bug','Terminal','TerminalSquare','GitBranch','GitCommit','GitMerge','GitPullRequest','Github','Twitter','Facebook','Instagram','Linkedin','Youtube','Slack','Figma','Dribbble','Codepen','Chrome','Aperture','Pocket','Workflow','Wrench','Hammer','HardHat','Megaphone','Mic2','Crosshair','Target','Trophy','Sparkles','Banknote','Receipt','Wallet','Coins','Landmark','Scale','Gavel','Newspaper','GraduationCap','School','Backpack','Library','Telescope','Microscope','FlaskConical','Atom','Dna','Pill','Stethoscope','HeartPulse','Brain','Bone','Eye','Glasses','Sofa','Bed','Bath','ShowerHead','Lamp','Plug','Tv','Tv2','Radio','Speaker','Disc','Disc3','Cassette','GamepadIcon','Gamepad2','Joystick','Dice1','Dice2','Dice3','Dice4','Dice5','Dice6','Puzzle','Cog'];
  COMMON_ICONS.forEach(function (name) {
    try { if (typeof window[name] === 'undefined') window[name] = GenericIcon; } catch (e) {}
  });

  // framer-motion shim. motion.<tag>(props) renders the underlying tag,
  // stripping animation-only props that would otherwise leak to the DOM.
  if (typeof window.motion === 'undefined') {
    try {
      var MOTION_PROPS = ['animate','initial','exit','transition','whileHover','whileTap','whileFocus','whileInView','whileDrag','viewport','layout','layoutId','layoutDependency','drag','dragConstraints','dragElastic','dragMomentum','dragTransition','dragListener','onDragStart','onDragEnd','onDrag','variants','custom','inherit','transformTemplate','onAnimationStart','onAnimationComplete','onUpdate'];
      window.motion = new Proxy({}, {
        get: function (_, tag) {
          if (typeof tag !== 'string') return undefined;
          return function MotionComponent(props) {
            var p = props || {};
            var rest = {};
            Object.keys(p).forEach(function (k) {
              if (MOTION_PROPS.indexOf(k) === -1) rest[k] = p[k];
            });
            return React.createElement(tag, rest);
          };
        }
      });
    } catch (e) {}
  }
  if (typeof window.AnimatePresence === 'undefined') {
    window.AnimatePresence = function AnimatePresence(props) {
      return (props && props.children) || null;
    };
  }
  if (typeof window.LazyMotion === 'undefined') {
    window.LazyMotion = function LazyMotion(props) {
      return (props && props.children) || null;
    };
  }

  // Next.js Link / Image shims. The agent is told not to use these, but
  // edits sometimes preserve a stray reference from an earlier output.
  if (typeof window.NextLink === 'undefined') {
    window.NextLink = function NextLink(props) {
      var p = props || {};
      var rest = {};
      Object.keys(p).forEach(function (k) { if (k !== 'children') rest[k] = p[k]; });
      rest.href = p.href || '#';
      return React.createElement('a', rest, p.children);
    };
  }
  if (typeof window.NextImage === 'undefined') {
    window.NextImage = function NextImage(props) {
      var p = props || {};
      return React.createElement('img', {
        src: p.src,
        alt: p.alt || '',
        width: p.width,
        height: p.height,
        className: p.className,
        style: p.style,
        loading: 'lazy'
      });
    };
  }

  function classJoin() {
    var classes = [];
    for (var i = 0; i < arguments.length; i++) {
      var arg = arguments[i];
      if (!arg) continue;
      if (typeof arg === 'string' || typeof arg === 'number') {
        classes.push(arg);
      } else if (Array.isArray(arg)) {
        var inner = classJoin.apply(null, arg);
        if (inner) classes.push(inner);
      } else if (typeof arg === 'object') {
        for (var key in arg) { if (arg[key]) classes.push(key); }
      }
    }
    return classes.join(' ');
  }
  if (typeof window.clsx === 'undefined') window.clsx = classJoin;
  if (typeof window.cn === 'undefined') window.cn = classJoin;
  if (typeof window.classNames === 'undefined') window.classNames = classJoin;
  if (typeof window.twMerge === 'undefined') window.twMerge = classJoin;

  // ── Error reporting bridge ──
  // When the iframe is embedded inside the dashboard preview, errors bubble
  // to the parent window via postMessage. Standalone visits (/v/[id],
  // /sites/[subdomain]) have no parent — postMessage is a no-op and we
  // fall back to React error boundary's UI / browser console.
  function postErrorToParent(payload) {
    try {
      if (window.parent && window.parent !== window) {
        var safe = {
          type: 'forze:landing-error',
          kind: payload.kind || 'unknown',
          message: String(payload.message || 'Component error'),
          stack: payload.stack ? String(payload.stack).slice(0, 4000) : '',
          componentStack: payload.componentStack ? String(payload.componentStack).slice(0, 2000) : '',
          filename: payload.filename || '',
          lineno: typeof payload.lineno === 'number' ? payload.lineno : undefined,
          colno: typeof payload.colno === 'number' ? payload.colno : undefined,
          timestamp: Date.now()
        };
        window.parent.postMessage(safe, '*');
      }
    } catch (e) {}
  }

  // React error boundary — catches errors thrown during render / commit.
  if (typeof window.__ForzeErrorBoundary__ === 'undefined') {
    try {
      var ForzeErrorBoundary = function (props) {
        React.Component.call(this, props);
        this.state = { error: null };
      };
      ForzeErrorBoundary.prototype = Object.create(React.Component.prototype);
      ForzeErrorBoundary.prototype.constructor = ForzeErrorBoundary;
      ForzeErrorBoundary.getDerivedStateFromError = function (error) {
        return { error: error };
      };
      ForzeErrorBoundary.prototype.componentDidCatch = function (error, info) {
        postErrorToParent({
          kind: 'react',
          message: (error && error.message) || String(error),
          stack: (error && error.stack) || '',
          componentStack: (info && info.componentStack) || ''
        });
        try { console.error('[Forze landing] React error caught:', error, info); } catch (e) {}
      };
      ForzeErrorBoundary.prototype.render = function () {
        if (!this.state.error) return this.props.children;
        var err = this.state.error;
        var msg = (err && err.message) || 'Component failed to render.';
        var stack = (err && err.stack) || '';
        return React.createElement('div', {
          style: {
            minHeight: '100vh', padding: 40,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            background: '#0a0a0a', color: '#e5e5e5',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center'
          }
        },
          React.createElement('div', { style: { maxWidth: 720, width: '100%', marginTop: 80 } },
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 } },
              React.createElement('div', {
                style: {
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(239,68,68,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }
              },
                React.createElement('svg', {
                  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
                  stroke: '#ef4444', strokeWidth: 2,
                  strokeLinecap: 'round', strokeLinejoin: 'round'
                },
                  React.createElement('circle', { cx: 12, cy: 12, r: 10 }),
                  React.createElement('line', { x1: 12, y1: 8, x2: 12, y2: 12 }),
                  React.createElement('line', { x1: 12, y1: 16, x2: 12.01, y2: 16 })
                )
              ),
              React.createElement('div', null,
                React.createElement('div', {
                  style: { fontSize: 11, color: '#888', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }
                }, 'Landing preview error'),
                React.createElement('div', {
                  style: { fontSize: 18, fontWeight: 600, color: '#f3f4f6', marginTop: 4 }
                }, 'Component failed to render')
              )
            ),
            React.createElement('div', {
              style: { background: '#171717', border: '1px solid #262626', borderRadius: 12, padding: 16, marginBottom: 16 }
            },
              React.createElement('div', {
                style: { fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 13, color: '#fca5a5', marginBottom: stack ? 8 : 0, wordBreak: 'break-word' }
              }, msg),
              stack ? React.createElement('pre', {
                style: { fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, color: '#737373', whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto', margin: 0 }
              }, stack) : null
            ),
            React.createElement('div', { style: { fontSize: 13, color: '#a3a3a3', lineHeight: 1.7 } },
              'Try regenerating the landing page or describing what to change in the edit input. The error message is also visible in the dashboard preview banner.'
            )
          )
        );
      };
      window.__ForzeErrorBoundary__ = ForzeErrorBoundary;
    } catch (e) {}
  }

  // ── Third-party lead-capture endpoint hijack ──
  // Gemini occasionally hallucinates a v0.dev-style POST endpoint
  // (\`https://api.v0.dev/leads/<uuid>\`) instead of the local
  // \`/api/ventures/<id>/leads\` we instruct it to use. The CSP blocks the
  // cross-origin request and the founder sees a broken waitlist form. We
  // monkey-patch fetch + XHR to rewrite those URLs to the local endpoint
  // when ventureId is available, or short-circuit them with a fake 200 so
  // preview surfaces don't show a network error.
  (function () {
    var THIRD_PARTY_LEAD_HOST = /^https?:\\/\\/(?:[\\w-]+\\.)*v0\\.dev\\/(?:api\\/)?leads(?:\\/|$|\\?)/i;
    function localLeadsUrl() {
      var vid = window.__VENTURE_ID__;
      return (typeof vid === 'string' && vid) ? '/api/ventures/' + vid + '/leads' : '';
    }
    function rewriteLeadUrl(input) {
      try {
        var url = typeof input === 'string'
          ? input
          : (input && typeof input === 'object' && typeof input.url === 'string')
            ? input.url
            : '';
        if (!url || !THIRD_PARTY_LEAD_HOST.test(url)) return { matched: false, value: input };
        var fixed = localLeadsUrl();
        if (!fixed) return { matched: true, value: null };
        if (typeof input === 'string') return { matched: true, value: fixed };
        try { return { matched: true, value: new Request(fixed, input) }; }
        catch (e) { return { matched: true, value: fixed }; }
      } catch (e) { return { matched: false, value: input }; }
    }
    try {
      var origFetch = window.fetch && window.fetch.bind(window);
      if (origFetch) {
        window.fetch = function (input, init) {
          var r = rewriteLeadUrl(input);
          if (r.matched && r.value === null) {
            return Promise.resolve(new Response(
              JSON.stringify({ ok: true, message: 'Preview mode — signup recorded locally only.' }),
              { status: 200, headers: { 'content-type': 'application/json' } }
            ));
          }
          return origFetch(r.matched ? r.value : input, init);
        };
      }
    } catch (e) {}
    try {
      var XHR = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
      if (XHR && XHR.open) {
        var origOpen = XHR.open;
        XHR.open = function (method, url) {
          try {
            if (typeof url === 'string' && THIRD_PARTY_LEAD_HOST.test(url)) {
              var fixed = localLeadsUrl();
              if (fixed) {
                arguments[1] = fixed;
              } else {
                arguments[1] = 'data:application/json,' + encodeURIComponent('{"ok":true}');
              }
            }
          } catch (e) {}
          return origOpen.apply(this, arguments);
        };
      }
    } catch (e) {}
  })();

  // Catch errors that happen outside React (script parse errors, async
  // throws, dynamic imports, etc.). These never reach the error boundary.
  window.addEventListener('error', function (event) {
    postErrorToParent({
      kind: 'script',
      message: event && event.message,
      filename: event && event.filename,
      lineno: event && event.lineno,
      colno: event && event.colno,
      stack: (event && event.error && event.error.stack) || ''
    });
  });
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    postErrorToParent({
      kind: 'promise',
      message: (reason && reason.message) || String(reason),
      stack: (reason && reason.stack) || ''
    });
  });
})();
<\/script>`

// ── Static validator ─────────────────────────────────────────────────────────
//
// Run BEFORE persisting a generated landing-page component. Catches the
// hallucinations the runtime shim doesn't (or shouldn't) silently mask:
//   • Forbidden imports — `lucide-react`, `framer-motion`, `next/image`,
//     `clsx`, etc. These get stripped at render time anyway, so the
//     references after the import line resolve to undefined.
//   • Inline references to libraries we won't ship — `LucideIcons.X`,
//     `motion.div`, `<NextImage>`. The runtime shim now Proxies these to
//     safe fallbacks, but the validator still surfaces them so the founder
//     knows the LLM drifted (and so the agent stream shows what to fix).
//   • Runtime hazards — `process.env.X` (no Node), `eval(`, `new Function(`,
//     `document.write(` (replaces the iframe), `dangerouslySetInnerHTML`
//     with template literals (XSS risk).
//   • Structural — brace / paren / bracket balance. Babel parses inside the
//     iframe; a mismatch crashes silently and shows a blank page. We catch
//     it here and surface the count.
//
// Auto-sanitization (`sanitized` field):
//   • Imports → replaced with `// removed (Forze runtime)` comments.
//   • `process.env.X` references → replaced with the literal string `""`.
//   • Other issues are reported only — sanitization there would change the
//     visual output, which is the wrong tradeoff vs. flagging the issue.
export type LandingComponentIssueSeverity = 'error' | 'warning' | 'info'

export type LandingComponentIssue = {
  severity: LandingComponentIssueSeverity
  message: string
  pattern: string
  suggestion: string
  line?: number
  autoFixed: boolean
}

type ValidatorRule = {
  pattern: RegExp
  severity: LandingComponentIssueSeverity
  buildMessage: (match: RegExpExecArray) => string
  suggestion: string
  replacement?: string | ((match: string) => string)
}

const VALIDATOR_RULES: ValidatorRule[] = [
  // ── Forbidden imports ──
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]lucide-react['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports from lucide-react (icon library is not loaded; the import is stripped)',
    suggestion: 'Use an emoji or inline <svg> instead. The runtime shim renders a generic SVG for any LucideIcons.X reference, but the visual quality will not match the requested icon.',
    replacement: '// removed (Forze runtime) — lucide-react not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]@?heroicons[\w\-/]*['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports from Heroicons (not loaded)',
    suggestion: 'Use an emoji or inline <svg>.',
    replacement: '// removed (Forze runtime) — Heroicons not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]react-icons[\w\-/]*['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports from react-icons (not loaded)',
    suggestion: 'Use an emoji or inline <svg>.',
    replacement: '// removed (Forze runtime) — react-icons not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]@?(tabler\/icons|phosphor-icons|@phosphor-icons[\w\-/]*|feather-icons|@fortawesome[\w\-/]*)['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports an icon library that is not available at runtime',
    suggestion: 'Use an emoji or inline <svg>.',
    replacement: '// removed (Forze runtime) — icon library not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]framer-motion['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports from framer-motion (not loaded)',
    suggestion: 'Use Tailwind transitions/animations or CSS keyframes. The runtime shim renders motion.<tag> as plain <tag> with animation props stripped.',
    replacement: '// removed (Forze runtime) — framer-motion not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]next\/(image|link|router|navigation|head|script|font|dynamic)['"];?/gm,
    severity: 'warning',
    buildMessage: (m) => `Imports from next/${m[1]} (Next.js modules are not available in the iframe)`,
    suggestion: 'Use plain <a>, <img>, etc.',
    replacement: '// removed (Forze runtime) — Next.js modules not available',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"](clsx|classnames|tailwind-merge|tw-merge)['"];?/gm,
    severity: 'info',
    buildMessage: (m) => `Imports ${m[1]} (shimmed at runtime — no import needed)`,
    suggestion: 'The runtime exposes clsx, cn, classNames, and twMerge as globals. Drop the import.',
    replacement: '// removed (Forze runtime) — class util is a global',
  },
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"]@?(react-router|@reach\/router)[\w\-/]*['"];?/gm,
    severity: 'warning',
    buildMessage: () => 'Imports a router library (not available in the iframe)',
    suggestion: 'Use plain anchor links — the iframe is a single static page.',
    replacement: '// removed (Forze runtime) — router not available',
  },
  // Catch-all: any other ES module import that survives is bound to fail
  // because Babel-standalone in script mode does NOT resolve specifiers.
  {
    pattern: /^\s*import\s+[^;\n]+from\s+['"][^'"\n]+['"];?/gm,
    severity: 'info',
    buildMessage: (m) => `Stripped import statement: ${m[0].trim().slice(0, 80)}`,
    suggestion: 'Remove imports from the component. Use globals only (React, hooks, Tailwind).',
    replacement: '// removed (Forze runtime) — imports are not resolved',
  },

  // ── Runtime hazards ──
  {
    pattern: /\bprocess\.env\.[A-Z_][\w]*/g,
    severity: 'error',
    buildMessage: (m) => `References ${m[0]} — there is no Node environment in the iframe`,
    suggestion: 'Inline the value, fetch it from your API, or expose it via window before render.',
    replacement: '""',
  },
  {
    pattern: /\beval\s*\(/g,
    severity: 'error',
    buildMessage: () => 'Calls eval() — blocked by safety review',
    suggestion: 'Inline the logic; never build code from strings.',
  },
  {
    pattern: /\bnew\s+Function\s*\(/g,
    severity: 'error',
    buildMessage: () => 'Constructs new Function() — blocked by safety review',
    suggestion: 'Inline the logic; never build code from strings.',
  },
  {
    pattern: /\bdocument\.write\s*\(/g,
    severity: 'error',
    buildMessage: () => 'Calls document.write — replaces the iframe contents entirely',
    suggestion: 'Render with React instead.',
  },

  // ── Third-party lead endpoint (Gemini hallucinates v0.dev) ──
  // The agent is told to POST to `/api/ventures/${ventureId}/leads`, but
  // the model occasionally emits a v0.dev-style URL it picked up from
  // training data. Rewrite to a template string the component already
  // resolves via window.__VENTURE_ID__, so the saved source matches what
  // the runtime shim will fall back to anyway.
  {
    pattern: /["'`]https?:\/\/(?:[\w-]+\.)*v0\.dev\/(?:api\/)?leads(?:\/[^"'`\s]*)?["'`]/g,
    severity: 'error',
    buildMessage: () => 'Posts to v0.dev/leads (third-party endpoint blocked by CSP)',
    suggestion: 'Replaced with `/api/ventures/${ventureId}/leads` so the lead lands in your CRM.',
    replacement: '`/api/ventures/${(typeof window!=="undefined"&&window.__VENTURE_ID__)||""}/leads`',
  },

  // ── Drift detection (shim catches these, but report them) ──
  {
    pattern: /<LucideIcons\.([A-Z][\w$]*)/g,
    severity: 'info',
    buildMessage: (m) => `Renders <LucideIcons.${m[1]}> — falling back to generic SVG icon`,
    suggestion: 'Replace with an inline <svg> or emoji for the right visual.',
  },
  {
    pattern: /<motion\.([a-z][\w$]*)/g,
    severity: 'info',
    buildMessage: (m) => `Renders <motion.${m[1]}> — falling back to <${m[1]}> with animation props stripped`,
    suggestion: 'Animate with Tailwind transitions/animations or CSS keyframes.',
  },
  {
    pattern: /<AnimatePresence\b/g,
    severity: 'info',
    buildMessage: () => 'Uses <AnimatePresence> — pass-through rendered (no enter/exit animations)',
    suggestion: 'Use CSS transitions instead.',
  },
]

function lineNumberOf(code: string, index: number): number {
  if (index <= 0) return 1
  let line = 1
  for (let i = 0; i < index && i < code.length; i++) {
    if (code.charCodeAt(i) === 10) line++
  }
  return line
}

function checkBalance(code: string): { braces: number; parens: number; brackets: number } {
  let braces = 0
  let parens = 0
  let brackets = 0
  let inString: string | null = null
  let inComment: 'line' | 'block' | null = null
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]
    const next = code[i + 1]
    if (inComment === 'line') {
      if (ch === '\n') inComment = null
      continue
    }
    if (inComment === 'block') {
      if (ch === '*' && next === '/') { inComment = null; i++ }
      continue
    }
    if (inString) {
      if (ch === '\\') { i++; continue }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && next === '/') { inComment = 'line'; i++; continue }
    if (ch === '/' && next === '*') { inComment = 'block'; i++; continue }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue }
    if (ch === '{') braces++
    else if (ch === '}') braces--
    else if (ch === '(') parens++
    else if (ch === ')') parens--
    else if (ch === '[') brackets++
    else if (ch === ']') brackets--
  }
  return { braces, parens, brackets }
}

export function validateLandingComponent(code: string): {
  issues: LandingComponentIssue[]
  sanitized: string
  hasErrors: boolean
} {
  if (typeof code !== 'string' || !code.trim()) {
    return {
      issues: [{
        severity: 'error',
        message: 'Component code is empty',
        pattern: '',
        suggestion: 'Regenerate the landing page.',
        autoFixed: false,
      }],
      sanitized: code || '',
      hasErrors: true,
    }
  }

  const issues: LandingComponentIssue[] = []
  let sanitized = code

  for (const rule of VALIDATOR_RULES) {
    const lookup = new RegExp(rule.pattern.source, rule.pattern.flags)
    const matches: RegExpExecArray[] = []
    let m: RegExpExecArray | null
    while ((m = lookup.exec(code)) !== null) {
      matches.push(m)
      if (!lookup.global) break
      if (m.index === lookup.lastIndex) lookup.lastIndex++
    }
    for (const match of matches) {
      issues.push({
        severity: rule.severity,
        message: rule.buildMessage(match),
        pattern: match[0],
        suggestion: rule.suggestion,
        line: lineNumberOf(code, match.index),
        autoFixed: rule.replacement !== undefined,
      })
    }
    if (rule.replacement !== undefined) {
      const apply = new RegExp(rule.pattern.source, rule.pattern.flags)
      sanitized = typeof rule.replacement === 'string'
        ? sanitized.replace(apply, rule.replacement)
        : sanitized.replace(apply, rule.replacement)
    }
  }

  const balance = checkBalance(sanitized)
  if (balance.braces !== 0) {
    issues.push({
      severity: 'error',
      message: `Brace mismatch: ${balance.braces > 0 ? `${balance.braces} unclosed '{'` : `${Math.abs(balance.braces)} extra '}'`}`,
      pattern: '{ }',
      suggestion: 'Component will fail to parse. Regenerate or ask for a structural fix.',
      autoFixed: false,
    })
  }
  if (balance.parens !== 0) {
    issues.push({
      severity: 'error',
      message: `Paren mismatch: ${balance.parens > 0 ? `${balance.parens} unclosed '('` : `${Math.abs(balance.parens)} extra ')'`}`,
      pattern: '( )',
      suggestion: 'Component will fail to parse. Regenerate or ask for a structural fix.',
      autoFixed: false,
    })
  }
  if (balance.brackets !== 0) {
    issues.push({
      severity: 'error',
      message: `Bracket mismatch: ${balance.brackets > 0 ? `${balance.brackets} unclosed '['` : `${Math.abs(balance.brackets)} extra ']'`}`,
      pattern: '[ ]',
      suggestion: 'Component will fail to parse. Regenerate or ask for a structural fix.',
      autoFixed: false,
    })
  }

  const hasErrors = issues.some((issue) => issue.severity === 'error')
  return { issues, sanitized, hasErrors }
}

export function summariseIssues(issues: LandingComponentIssue[]): string {
  if (issues.length === 0) return 'No issues detected.'
  const counts = { error: 0, warning: 0, info: 0 }
  for (const issue of issues) counts[issue.severity]++
  const parts: string[] = []
  if (counts.error) parts.push(`${counts.error} error${counts.error === 1 ? '' : 's'}`)
  if (counts.warning) parts.push(`${counts.warning} warning${counts.warning === 1 ? '' : 's'}`)
  if (counts.info) parts.push(`${counts.info} info`)
  return parts.join(', ')
}

export function stripGeneratedCodeFences(code: unknown): string {
  if (typeof code !== 'string') return ''

  return code
    .replace(/```(?:tsx|jsx|html|javascript|typescript)?\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

export function isRenderableLandingComponent(code: unknown): code is string {
  const clean = stripGeneratedCodeFences(code)
  if (!clean) return false
  if (LANDING_PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(clean))) return false

  const looksLikeComponent =
    /export\s+default/i.test(clean) ||
    /function\s+[A-Z_a-z][\w$]*\s*\(/.test(clean) ||
    /const\s+[A-Z_a-z][\w$]*\s*=\s*\(/.test(clean) ||
    /const\s+[A-Z_a-z][\w$]*\s*=\s*\(\)\s*=>/.test(clean) ||
    /\buseState\b/.test(clean)

  const looksLikeMarkup = /<[A-Za-z][\s\S]*>/.test(clean)

  return looksLikeComponent || looksLikeMarkup
}

export function resolveLandingComponent(input: {
  ventureName?: string
  fullComponent?: unknown
  landingPageCopy?: LandingPageCopy | null
  seoMetadata?: SeoMetadata | null
  colorPalette?: unknown
}): string {
  const clean = stripGeneratedCodeFences(input.fullComponent)
  if (isRenderableLandingComponent(clean)) return clean

  return buildFallbackLandingComponent({
    ventureName: input.ventureName,
    landingPageCopy: input.landingPageCopy,
    seoMetadata: input.seoMetadata,
    colorPalette: input.colorPalette,
  })
}

function buildFallbackLandingComponent(input: {
  ventureName?: string
  landingPageCopy?: LandingPageCopy | null
  seoMetadata?: SeoMetadata | null
  colorPalette?: unknown
}): string {
  const ventureName = sanitizeVentureName(input.ventureName)
  const copy = input.landingPageCopy ?? {}
  const hero = copy.hero ?? {}

  const headline = stringOrFallback(hero.headline, `Launch ${ventureName} with confidence`)
  const subheadline = stringOrFallback(
    hero.subheadline,
    'A polished landing page fallback was generated automatically so your launch preview stays usable.'
  )
  const ctaPrimary = stringOrFallback(hero.ctaPrimary, 'Join the waitlist')
  const ctaSecondary = stringOrFallback(hero.ctaSecondary, 'See pricing')

  const features = normalizeFeatures(copy.features)
  const testimonials = normalizeTestimonials(copy.socialProof)
  const pricing = normalizePricing(copy.pricing)
  const faq = normalizeFaq(copy.faq)
  const seo = input.seoMetadata ?? {}
  const metaTitle = stringOrFallback(seo.title, ventureName)
  const metaDescription = stringOrFallback(
    seo.description,
    `${ventureName} is ready for a clean launch preview while the full generated page is being finalized.`
  )
  const keywords = normalizeKeywords(seo.keywords)
  const [bgColor, primaryColor, accentColor] = extractPalette(input.colorPalette)

  return [
    'function LandingPage() {',
    `  const hero = ${JSON.stringify({ headline, subheadline, ctaPrimary, ctaSecondary })};`,
    `  const features = ${JSON.stringify(features)};`,
    `  const testimonials = ${JSON.stringify(testimonials)};`,
    `  const pricing = ${JSON.stringify(pricing)};`,
    `  const faq = ${JSON.stringify(faq)};`,
    `  const meta = ${JSON.stringify({ title: metaTitle, description: metaDescription, keywords })};`,
    `  const palette = ${JSON.stringify({ bgColor, primaryColor, accentColor })};`,
    '  const [email, setEmail] = useState("");',
    '  const [error, setError] = useState("");',
    '  const [submitted, setSubmitted] = useState(false);',
    '  const [openFaq, setOpenFaq] = useState(0);',
    '  const year = new Date().getFullYear();',
    '',
    '  const handleSubmit = (event) => {',
    '    event.preventDefault();',
    '    const nextEmail = email.trim();',
    '    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(nextEmail)) {',
    '      setSubmitted(false);',
    '      setError("Enter a valid email address.");',
    '      return;',
    '    }',
    '    setError("");',
    '    setSubmitted(true);',
    '    setEmail("");',
    '  };',
    '',
    '  return (',
    '    <div className="min-h-screen bg-slate-950 text-slate-100">',
    '      <style>{`:root{--lp-bg:${palette.bgColor};--lp-primary:${palette.primaryColor};--lp-accent:${palette.accentColor};} html{scroll-behavior:smooth;}`}</style>',
    '      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">',
    '        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">',
    '          <a href="#top" className="text-sm font-semibold tracking-[0.24em] text-white/80 uppercase">{meta.title}</a>',
    '          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">',
    '            <a href="#features" className="transition hover:text-white">Features</a>',
    '            <a href="#testimonials" className="transition hover:text-white">Proof</a>',
    '            <a href="#pricing" className="transition hover:text-white">Pricing</a>',
    '            <a href="#faq" className="transition hover:text-white">FAQ</a>',
    '          </nav>',
    '          <a',
    '            href="#signup"',
    '            className="rounded-full px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg transition hover:opacity-90"',
    '            style={{ backgroundColor: "var(--lp-accent)" }}',
    '          >',
    '            {hero.ctaPrimary}',
    '          </a>',
    '        </div>',
    '      </header>',
    '',
    '      <main id="top">',
    '        <section className="relative overflow-hidden">',
    '          <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at top left, ${palette.primaryColor}55, transparent 38%), radial-gradient(circle at top right, ${palette.accentColor}40, transparent 34%), linear-gradient(135deg, ${palette.bgColor} 0%, #020617 60%, #020617 100%)` }} />',
    '          <div className="relative mx-auto grid min-h-[88vh] max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">',
    '            <div className="max-w-2xl">',
    '              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Launch Preview Ready</p>',
    '              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">{hero.headline}</h1>',
    '              <p className="mt-6 max-w-xl text-base leading-8 text-white/70 sm:text-lg">{hero.subheadline}</p>',
    '              <div className="mt-8 flex flex-col gap-3 sm:flex-row">',
    '                <a',
    '                  href="#signup"',
    '                  className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold text-slate-950 shadow-xl transition hover:translate-y-[-1px]"',
    '                  style={{ backgroundColor: "var(--lp-accent)" }}',
    '                >',
    '                  {hero.ctaPrimary}',
    '                </a>',
    '                <a href="#pricing" className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10">{hero.ctaSecondary}</a>',
    '              </div>',
    '              <div className="mt-10 grid gap-3 text-sm text-white/70 sm:grid-cols-3">',
    '                {features.slice(0, 3).map((feature) => (',
    '                  <div key={feature.title} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 backdrop-blur-md">',
    '                    <div className="text-lg">{feature.icon}</div>',
    '                    <div className="mt-2 font-semibold text-white">{feature.title}</div>',
    '                  </div>',
    '                ))}',
    '              </div>',
    '            </div>',
    '            <div className="rounded-[28px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">',
    '              <div className="rounded-[24px] border border-white/10 bg-slate-950/80 p-6">',
    '                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/50">Why this fallback exists</p>',
    '                <h2 className="mt-4 text-2xl font-semibold text-white">Your launch page stays live even when AI output is incomplete.</h2>',
    '                <p className="mt-4 text-sm leading-7 text-white/70">{meta.description}</p>',
    '                <ul className="mt-6 space-y-3 text-sm text-white/70">',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Structured copy is still surfaced from the landing module output.</li>',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Visitors can keep signing up while the richer generated page is retried.</li>',
    '                  <li className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">The dashboard preview and live route now resolve the same component safely.</li>',
    '                </ul>',
    '              </div>',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="features" className="bg-white px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Features</p>',
    '            <div className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Everything the launch page needs to stay useful.</div>',
    '            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">',
    '              {features.map((feature) => (',
    '                <article key={feature.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">',
    '                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-xl text-white" style={{ backgroundColor: "var(--lp-primary)" }}>{feature.icon}</div>',
    '                  <h3 className="mt-5 text-xl font-semibold text-slate-950">{feature.title}</h3>',
    '                  <p className="mt-3 text-sm leading-7 text-slate-600">{feature.description}</p>',
    '                </article>',
    '              ))}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="testimonials" className="bg-slate-100 px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Proof</p>',
    '            <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Even the fallback tells the story clearly.</div>',
    '            <div className="mt-12 grid gap-6 lg:grid-cols-3">',
    '              {testimonials.map((testimonial, index) => (',
    '                <article key={`${testimonial.name}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">',
    '                  <div className="text-3xl leading-none" style={{ color: "var(--lp-accent)" }}>"</div>',
    '                  <p className="mt-4 text-sm leading-7 text-slate-600">{testimonial.quote}</p>',
    '                  <div className="mt-6 text-sm font-semibold text-slate-950">{testimonial.name}</div>',
    '                  <div className="text-sm text-slate-500">{testimonial.role}</div>',
    '                </article>',
    '              ))}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="pricing" className="bg-slate-950 px-4 py-24 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-6xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50">Pricing</p>',
    '            <div className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">A working pricing section is available immediately.</div>',
    '            <div className="mt-12 grid gap-6 xl:grid-cols-3">',
    '              {pricing.map((tier, index) => {',
    '                const highlighted = index === 1 || (pricing.length === 1 && index === 0);',
    '                return (',
    '                  <article',
    '                    key={tier.tier}',
    '                    className={`rounded-3xl border p-6 shadow-xl ${highlighted ? "border-transparent bg-white text-slate-950" : "border-white/10 bg-white/5 text-white"}`}',
    '                    style={highlighted ? { boxShadow: `0 20px 60px ${palette.accentColor}33` } : undefined}',
    '                  >',
    '                    <div className="flex items-center justify-between gap-4">',
    '                      <h3 className="text-xl font-semibold">{tier.tier}</h3>',
    '                      {highlighted ? <span className="rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950" style={{ backgroundColor: "var(--lp-accent)" }}>Popular</span> : null}',
    '                    </div>',
    '                    <div className="mt-6 text-4xl font-semibold tracking-tight">{tier.price}</div>',
    '                    <ul className="mt-6 space-y-3 text-sm leading-7">',
    '                      {tier.features.map((feature) => (',
    '                        <li key={feature} className="flex gap-3"><span style={{ color: "var(--lp-accent)" }}>-</span><span>{feature}</span></li>',
    '                      ))}',
    '                    </ul>',
    '                    <a',
    '                      href="#signup"',
    '                      className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition hover:opacity-90 ${highlighted ? "text-slate-950" : "bg-white text-slate-950"}`}',
    '                      style={highlighted ? { backgroundColor: "var(--lp-accent)" } : undefined}',
    '                    >',
    '                      {tier.cta}',
    '                    </a>',
    '                  </article>',
    '                );',
    '              })}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="faq" className="bg-white px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto max-w-4xl">',
    '            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">FAQ</p>',
    '            <div className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Questions are still answered while generation is retried.</div>',
    '            <div className="mt-12 space-y-4">',
    '              {faq.map((item, index) => {',
    '                const isOpen = openFaq === index;',
    '                return (',
    '                  <div key={item.question} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">',
    '                    <button',
    '                      type="button"',
    '                      onClick={() => setOpenFaq(isOpen ? -1 : index)}',
    '                      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"',
    '                    >',
    '                      <span className="text-base font-semibold text-slate-950">{item.question}</span>',
    '                      <span className="text-xl" style={{ color: "var(--lp-primary)" }}>{isOpen ? "-" : "+"}</span>',
    '                    </button>',
    '                    {isOpen ? <div className="px-6 pb-6 text-sm leading-7 text-slate-600">{item.answer}</div> : null}',
    '                  </div>',
    '                );',
    '              })}',
    '            </div>',
    '          </div>',
    '        </section>',
    '',
    '        <section id="signup" className="bg-slate-100 px-4 py-24 text-slate-900 sm:px-6 lg:px-8">',
    '          <div className="mx-auto grid max-w-6xl gap-10 rounded-[32px] border border-slate-200 bg-white p-8 shadow-xl lg:grid-cols-[1fr_0.9fr] lg:p-12">',
    '            <div>',
    '              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Lead Capture</p>',
    '              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Collect signups now instead of waiting on a rerun.</h2>',
    '              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600">This fallback keeps a polished signup flow online. Once the richer generated page succeeds, the same launch route will serve it automatically.</p>',
    '              <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">',
    '                {meta.keywords.slice(0, 4).map((keyword) => (',
    '                  <span key={keyword} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2">{keyword}</span>',
    '                ))}',
    '              </div>',
    '            </div>',
    '            <form onSubmit={handleSubmit} className="rounded-[28px] border border-slate-200 bg-slate-50 p-6 shadow-sm">',
    '              <label htmlFor="email" className="text-sm font-semibold text-slate-950">Work email</label>',
    '              <input',
    '                id="email"',
    '                type="email"',
    '                value={email}',
    '                onChange={(event) => setEmail(event.target.value)}',
    '                placeholder="you@company.com"',
    '                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"',
    '              />',
    '              {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}',
    '              {submitted ? <p className="mt-3 text-sm text-emerald-600">Thanks. Your signup was captured in demo mode.</p> : null}',
    '              <button',
    '                type="submit"',
    '                className="mt-5 inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg transition hover:opacity-90"',
    '                style={{ backgroundColor: "var(--lp-accent)" }}',
    '              >',
    '                {hero.ctaPrimary}',
    '              </button>',
    '              <p className="mt-3 text-xs leading-6 text-slate-500">No spam. This form intentionally runs in preview-safe demo mode.</p>',
    '            </form>',
    '          </div>',
    '        </section>',
    '      </main>',
    '',
    '      <footer className="border-t border-white/10 bg-slate-950 px-4 py-10 text-sm text-white/60 sm:px-6 lg:px-8">',
    '        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">',
    '          <div>{meta.title}</div>',
    '          <div>(c) {year} {meta.title}. Preview served by Forze.</div>',
    '        </div>',
    '      </footer>',
    '',
    '      <a',
    '        href="https://tryForze.ai"',
    '        target="_blank"',
    '        rel="noreferrer"',
    '        style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 9999, display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.85)", color: "white", fontSize: "11px", fontWeight: 500, padding: "7px 14px", borderRadius: "20px", textDecoration: "none", backdropFilter: "blur(10px)", boxShadow: "0 2px 12px rgba(0,0,0,0.3)" }}',
    '      >',
    '        Built with Forze',
    '      </a>',
    '    </div>',
    '  );',
    '}',
  ].join('\n')
}

function sanitizeVentureName(name: string | undefined): string {
  const base = stringOrFallback(name, 'Your Venture')
    .split('\n')[0]
    .split(':')[0]
    .trim()

  return base || 'Your Venture'
}

function stringOrFallback(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const clean = value.trim()
  return clean || fallback
}

function normalizeFeatures(features: LandingFeature[] | undefined): Array<{ title: string; description: string; icon: string }> {
  const normalized = Array.isArray(features)
    ? features
        .map((feature, index) => ({
          title: stringOrFallback(feature?.title, `Feature ${index + 1}`),
          description: stringOrFallback(
            feature?.description,
            'This section stays online with clear messaging even when the richer generated component needs another pass.'
          ),
          icon: stringOrFallback(feature?.icon, index % 2 === 0 ? '*' : 'o'),
        }))
        .filter((feature) => feature.title || feature.description)
    : []

  if (normalized.length >= 3) return normalized.slice(0, 6)

  return [
    ...normalized,
    {
      title: 'Launch-safe fallback',
      description: 'Preview and live launch routes now resolve a safe landing page instead of publishing placeholder output.',
      icon: '*',
    },
    {
      title: 'Structured content preserved',
      description: 'Hero copy, pricing, testimonials, and FAQs are still shown using the landing module data that already exists.',
      icon: 'o',
    },
    {
      title: 'Retry-friendly pipeline',
      description: 'When the AI returns incomplete component code, Forze can recover without taking your launch page down.',
      icon: '^',
    },
  ].slice(0, 3)
}

function normalizeTestimonials(socialProof: unknown): Array<{ quote: string; name: string; role: string }> {
  const items = Array.isArray(socialProof) ? socialProof : []

  const normalized = items
    .map((item, index) => {
      const raw = typeof item === 'string' ? item.trim() : ''
      if (!raw) return null

      const parts = raw.split(' - ')
      const quote = parts[0]?.replace(/^"+|"+$/g, '').trim() || raw
      const attribution = parts[1]?.trim() || `Customer ${index + 1}, Early Access`
      return {
        quote,
        name: attribution.split(',')[0]?.trim() || `Customer ${index + 1}`,
        role: attribution.split(',').slice(1).join(',').trim() || 'Early Access',
      }
    })
    .filter((item): item is { quote: string; name: string; role: string } => Boolean(item))

  if (normalized.length > 0) return normalized.slice(0, 3)

  return [
    {
      quote: 'We could keep sharing a live page instead of apologizing for a broken launch preview.',
      name: 'Avery Shah',
      role: 'Founder, Early Access',
    },
    {
      quote: 'The fallback kept our landing page readable, on-brand, and ready for signups while the richer version retried.',
      name: 'Maya Reed',
      role: 'Growth Lead, Beta Team',
    },
    {
      quote: 'It solved the exact failure mode that used to publish a placeholder page instead of a usable site.',
      name: 'Jordan Kim',
      role: 'Product Operator, Launch Crew',
    },
  ]
}

function normalizePricing(pricing: LandingPricingTier[] | undefined): Array<{ tier: string; price: string; features: string[]; cta: string }> {
  const normalized = Array.isArray(pricing)
    ? pricing
        .map((tier, index) => ({
          tier: stringOrFallback(tier?.tier, `Tier ${index + 1}`),
          price: stringOrFallback(tier?.price, index === 0 ? '$0' : '$29'),
          features: normalizeStringList(tier?.features, [
            'Live launch page',
            'Lead capture form',
            'FAQ section',
            'Pricing block',
          ]),
          cta: stringOrFallback(tier?.cta, 'Get started'),
        }))
        .filter((tier) => tier.tier)
    : []

  if (normalized.length > 0) return normalized.slice(0, 3)

  return [
    {
      tier: 'Starter',
      price: '$0',
      features: ['Launch-safe fallback page', 'Responsive hero section', 'Preview-safe signup form', 'Live route support'],
      cta: 'Start free',
    },
    {
      tier: 'Growth',
      price: '$29',
      features: ['Everything in Starter', 'Testimonials and pricing', 'Structured FAQ accordion', 'Retry-friendly generation flow'],
      cta: 'Choose growth',
    },
    {
      tier: 'Scale',
      price: '$99',
      features: ['Everything in Growth', 'Priority reruns', 'Advanced landing customization', 'Deeper experiment support'],
      cta: 'Talk to us',
    },
  ]
}

function normalizeFaq(faq: LandingFaq[] | undefined): Array<{ question: string; answer: string }> {
  const normalized = Array.isArray(faq)
    ? faq
        .map((item) => ({
          question: stringOrFallback(item?.question, ''),
          answer: stringOrFallback(
            item?.answer,
            'Forze keeps a polished fallback live so visitors still see a complete page while the full generated component is retried.'
          ),
        }))
        .filter((item) => item.question)
    : []

  if (normalized.length > 0) return normalized.slice(0, 6)

  return [
    {
      question: 'Why am I seeing this version of the landing page?',
      answer: 'This fallback appears when the generated component output is incomplete or placeholder-only. It keeps the launch URL usable instead of showing a broken page.',
    },
    {
      question: 'Can visitors still sign up?',
      answer: 'Yes. The lead capture form stays visible so the page remains useful during retries or while generation is repaired.',
    },
    {
      question: 'Will the richer generated page replace this automatically?',
      answer: 'Yes. As soon as a valid landing component is available, the same preview and launch routes can render it without changing your link.',
    },
  ]
}

function normalizeKeywords(keywords: unknown): string[] {
  const normalized = Array.isArray(keywords)
    ? keywords
        .map((keyword) => (typeof keyword === 'string' ? keyword.trim() : ''))
        .filter(Boolean)
    : []

  return normalized.length > 0
    ? normalized.slice(0, 8)
    : ['startup launch', 'landing page', 'product validation', 'waitlist', 'conversion', 'go to market']
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  const normalized = Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : []

  return normalized.length > 0 ? normalized.slice(0, 6) : fallback
}

function extractPalette(colorPalette: unknown): [string, string, string] {
  const colors = Array.isArray(colorPalette)
    ? colorPalette
        .map((item) => {
          if (typeof item === 'string') return item.trim()
          if (item && typeof item === 'object') {
            const candidate = (item as { hex?: unknown; code?: unknown }).hex ?? (item as { code?: unknown }).code
            return typeof candidate === 'string' ? candidate.trim() : ''
          }
          return ''
        })
        .filter((color) => /^#(?:[0-9a-f]{3}){1,2}$/i.test(color))
    : []

  return [
    colors[0] ?? FALLBACK_COLORS[0],
    colors[1] ?? FALLBACK_COLORS[1],
    colors[2] ?? FALLBACK_COLORS[2],
  ]
}
