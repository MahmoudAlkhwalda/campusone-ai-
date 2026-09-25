import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// The generated source exports this hook; the workspace declaration artifact can lag source generation.
// @ts-ignore
import { useGetAuthSession, useHealthCheck, useLogIn, useLogOut, useMatchOpportunities, useOptimizeSemester, useSaveStudentProfile, useSignUp, useSimulateSemester } from '@workspace/api-client-react';
import { ArrowRight, BarChart3, Bot, BriefcaseBusiness, Building2, CalendarDays, ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Compass, DollarSign, ExternalLink, GraduationCap, HeartPulse, LineChart, LoaderCircle, LockKeyhole, Menu, PiggyBank, RotateCcw, Scale, ShieldCheck, Sparkles, WalletCards, X } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { demoOpportunities, loadCompanyOpportunities, matchOpportunities, saveCompanyOpportunity, type CompanyOpportunityInput, type OpportunityMatch } from './opportunities';

const queryClient = new QueryClient();
const STORAGE_KEY = 'campusone-last-simulation';
const SCENARIO_STORAGE_KEY = 'campusone-active-scenario';
const APPLIED_PLAN_STORAGE_KEY = 'campusone-applied-plan';

const OPPORTUNITY_PLAN_STORAGE_KEY = 'campusone-opportunity-plan';
const OPPORTUNITY_STORAGE_KEY = 'campusone-opportunity-simulation';
const UPDATED_PLAN_STORAGE_KEY = 'campusone-updated-plan';

type TuitionPayment = { month: number; amount: number };
type SemesterSimulationInput = {
  name: string; major: string; creditHours: number; costPerCredit: number; semesterDuration: number;
  currentBalance: number; monthlyIncome: number; transportation: number; food: number; otherExpenses: number;
  tuitionPayments: TuitionPayment[];
};
const ahmadDemoProfile: SemesterSimulationInput = {
  name: 'Ahmad',
  major: 'Computer Science',
  creditHours: 15,
  costPerCredit: 50,
  semesterDuration: 5,
  currentBalance: 1050,
  monthlyIncome: 100,
  transportation: 70,
  food: 90,
  otherExpenses: 40,
  tuitionPayments: [{ month: 1, amount: 300 }, { month: 3, amount: 450 }],
};
type MonthlyForecast = {
  month: number; label: string; startingBalance: number; income: number; tuition: number; food: number;
  transportation: number; otherExpenses: number; totalExpenses: number; endingBalance: number; isAtRisk: boolean;
};
type SemesterSimulationResult = {
  profile: SemesterSimulationInput; tuition: number; monthlyBalances: MonthlyForecast[]; finalProjectedBalance: number;
  firstRiskMonth: number | null; financialHealthScore: number; totalIncome: number; totalExpenses: number;
  totalTuition: number; lowestProjectedBalance: number;
};

type ScenarioControls = {
  creditHours: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  costPerCredit: number;
};

type ActiveScenario = {
  baselineProfile: SemesterSimulationInput;
  source: 'baseline' | 'futureme';
  controls: ScenarioControls;
  result: SemesterSimulationResult;
};

type OptimizerChanges = {
  livingSpendReductionPercent: number; monthlyIncomeAddition: number; tuitionPaymentShiftMonths: number;
  supportPercent: number; creditHoursReduction: number;
};
type OptimizerCandidate = {
  profile: SemesterSimulationInput; result: SemesterSimulationResult; changes: OptimizerChanges;
  targets: OpportunityTargets;
  stabilized: boolean; gap: number;
};

type OpportunityTargets = {
  tuitionSupportAmount: number; monthlyIncomeAmount: number; semesterIncomeAmount: number; currentGap: number;
};
type OptimizerIntervention = {
  kind: string; label: string; changes: OptimizerChanges; isolatedResult: SemesterSimulationResult;
  gapReduction: number; scoreChange: number; stabilized: boolean; whyThisHelps: string;
};
type SemesterOptimizationResult = {
  baseline: SemesterSimulationResult; recommendation: OptimizerCandidate; alternatives: OptimizerCandidate[];
  interventions: OptimizerIntervention[]; evaluatedCandidates: number; stabilized: boolean; gapReduced: boolean; policy: string;
};
type AppliedPlan = {
  before: SemesterSimulationResult;
  selected: OptimizerCandidate;
  interventions: OptimizerIntervention[];
};

type OpportunityPlan = AppliedPlan & { returnTo: '/dashboard' | '/fix-my-semester' };
type OpportunitySimulation = { opportunity: OpportunityMatch; sourceProfile: SemesterSimulationInput; before: SemesterSimulationResult; after: SemesterSimulationResult };
type UpdatedPlan = { before: SemesterSimulationResult; after: SemesterSimulationResult; optimizedPlan: AppliedPlan | null; opportunity: OpportunitySimulation | null };
type AuthState = { authenticated: boolean; user: { id: string; name: string; email: string } | null; profile: SemesterSimulationInput | null };

const money = (value: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)} JOD`;

const moneyExact = (value: number) =>
  `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)} JOD`;

function saveSimulation(result: SemesterSimulationResult) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

function loadSimulation(): SemesterSimulationResult | null {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SemesterSimulationResult) : null;
  } catch {
    return null;
  }
}

function controlsFromResult(result: SemesterSimulationResult): ScenarioControls {
  return {
    creditHours: result.profile.creditHours,
    monthlyIncome: result.profile.monthlyIncome,
    monthlyExpenses: result.profile.food + result.profile.transportation + result.profile.otherExpenses,
    costPerCredit: result.profile.costPerCredit,
  };
}

function saveActiveScenario(baseline: SemesterSimulationResult, controls: ScenarioControls, result: SemesterSimulationResult, source: ActiveScenario['source'] = 'futureme') {
  const activeScenario: ActiveScenario = { baselineProfile: baseline.profile, source, controls, result };
  window.localStorage.setItem(SCENARIO_STORAGE_KEY, JSON.stringify(activeScenario));
}

function loadActiveScenario(baseline: SemesterSimulationResult): ActiveScenario | null {
  try {
    const saved = window.localStorage.getItem(SCENARIO_STORAGE_KEY);
    if (!saved) return null;
    const scenario = JSON.parse(saved) as ActiveScenario;
    return JSON.stringify(scenario.baselineProfile) === JSON.stringify(baseline.profile)
      ? { ...scenario, source: scenario.source ?? 'futureme' }
      : null;
  } catch {
    return null;
  }
}

function saveAppliedPlan(plan: AppliedPlan) {
  window.localStorage.setItem(APPLIED_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

function loadAppliedPlan(simulation: SemesterSimulationResult): AppliedPlan | null {
  try {
    const saved = window.localStorage.getItem(APPLIED_PLAN_STORAGE_KEY);
    if (!saved) return null;
    const plan = JSON.parse(saved) as AppliedPlan;
    return JSON.stringify(plan.selected.result.profile) === JSON.stringify(simulation.profile) ? plan : null;
  } catch {
    return null;
  }
}

function saveOpportunityPlan(plan: OpportunityPlan) {
  window.localStorage.setItem(OPPORTUNITY_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

function loadOpportunitySimulation(scenario?: SemesterSimulationResult | null): OpportunitySimulation | null {
  try {
    const saved = window.localStorage.getItem(OPPORTUNITY_STORAGE_KEY);
    if (!saved) return null;
    const simulation = JSON.parse(saved) as OpportunitySimulation;
    if (scenario && JSON.stringify(simulation.sourceProfile) !== JSON.stringify(scenario.profile)) return null;
    return simulation.sourceProfile ? simulation : null;
  } catch {
    return null;
  }
}

function saveUpdatedPlan(plan: UpdatedPlan) {
  window.localStorage.setItem(UPDATED_PLAN_STORAGE_KEY, JSON.stringify(plan));
}

function loadUpdatedPlan(simulation: SemesterSimulationResult): UpdatedPlan | null {
  try {
    const saved = window.localStorage.getItem(UPDATED_PLAN_STORAGE_KEY);
    if (!saved) return null;
    const plan = JSON.parse(saved) as UpdatedPlan;
    return JSON.stringify(plan.after.profile) === JSON.stringify(simulation.profile) ? plan : null;
  } catch {
    return null;
  }
}

function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`brand-mark ${inverse ? 'brand-mark-inverse' : ''}`} data-testid="link-home-logo">
      <img className="brand-lockup" src="/brand/campusone-lockup.png" alt="CampusOne — Financial Digital Twin" />
    </Link>
  );
}

function PageShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`page-shell ${className}`}>{children}</div>;
}

function clearStudentBrowserState() {
  [STORAGE_KEY, SCENARIO_STORAGE_KEY, APPLIED_PLAN_STORAGE_KEY, OPPORTUNITY_PLAN_STORAGE_KEY, OPPORTUNITY_STORAGE_KEY, UPDATED_PLAN_STORAGE_KEY].forEach((key) => window.localStorage.removeItem(key));
}

async function startAhmadDemo(setLocation: (path: string) => void, onError?: (message: string) => void) {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
  clearStudentBrowserState();
  queryClient.clear();
  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ahmadDemoProfile),
    });
    if (!response.ok) throw new Error('The Ahmad demo could not be loaded.');
    const result = await response.json() as SemesterSimulationResult;
    saveSimulation(result);
    setLocation('/dashboard');
  } catch {
    onError?.('The Ahmad demo could not load. Please try again.');
  }
}

function authError(error: unknown) {
  const data = (error as { data?: { error?: string } })?.data;
  return data?.error ?? 'CampusOne could not complete that request. Please try again.';
}

function AccountBadge({ fallbackName }: { fallbackName: string }) {
  const [, setLocation] = useLocation();
  const session = useGetAuthSession();
  const logout = useLogOut();
  if (!session.data?.authenticated) return <div className="account-links"><Link href="/sign-in">Log in</Link><Link href="/sign-up" className="button button-outline">Sign up</Link></div>;
  return <div className="dash-user"><span className="user-avatar">{(session.data.user?.name ?? fallbackName).slice(0, 1).toUpperCase()}</span><span>{session.data.user?.name ?? fallbackName}</span><button onClick={() => logout.mutate(undefined, { onSuccess: () => { clearStudentBrowserState(); queryClient.clear(); setLocation('/'); } })} data-testid="button-logout">Log out</button></div>;
}

function AuthPage({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const [, setLocation] = useLocation();
  const login = useLogIn();
  const signup = useSignUp();
  const simulation = useSimulateSemester();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoError, setDemoError] = useState('');
  const mutation = mode === 'sign-up' ? signup : login;

  const finish = (state: AuthState) => {
    queryClient.setQueryData(['/api/auth/session'], state);
    if (!state.profile) {
      setLocation('/setup');
      return;
    }
    simulation.mutate({ data: state.profile }, {
      onSuccess: (result: SemesterSimulationResult) => {
        saveSimulation(result);
        window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
        setLocation('/dashboard');
      },
    });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (mode === 'sign-up') signup.mutate({ data: { name, email, password } }, { onSuccess: finish });
    else login.mutate({ data: { email, password } }, { onSuccess: finish });
  };

  return <PageShell className="auth-page"><header className="setup-nav"><Logo /><Link href="/" className="close-setup"><X size={19} /></Link></header><main className="auth-main"><section className="auth-intro"><span className="eyebrow">{mode === 'sign-up' ? 'Create your account' : 'Welcome back'}</span><h1>{mode === 'sign-up' ? <>Save your semester,<br /><em>securely.</em></> : <>Continue your<br /><em>financial twin.</em></>}</h1><p>{mode === 'sign-up' ? 'Your saved profile will reload on your next visit. FutureMe scenarios stay temporary unless you explicitly apply them.' : 'Log in to reload your saved student profile and recalculate the Financial Twin.'}</p><button className="text-link" onClick={() => startAhmadDemo(setLocation, setDemoError)} data-testid="button-ahmad-demo">Explore Ahmad’s Demo <ArrowRight size={15} /></button>{demoError && <div className="form-error" role="alert">{demoError}</div>}</section><form className="auth-form" onSubmit={submit}>{mode === 'sign-up' && <Field label="Your name" value={name} onChange={setName} placeholder="e.g. Ahmad" testId="input-auth-name" />}<Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" testId="input-auth-email" /><Field label="Password" value={password} onChange={setPassword} placeholder="At least 8 characters" type="password" testId="input-auth-password" />{mutation.isError && <div className="form-error" role="alert">{authError(mutation.error)}</div>}<button className="button button-primary button-large" type="submit" disabled={mutation.isPending || simulation.isPending} data-testid="button-auth-submit">{mutation.isPending || simulation.isPending ? <LoaderCircle size={16} className="spin" /> : mode === 'sign-up' ? 'Create account' : 'Log in'} <ArrowRight size={16} /></button><p>{mode === 'sign-up' ? <>Already have an account? <Link href="/sign-in">Log in</Link></> : <>New to CampusOne? <Link href="/sign-up">Sign up</Link></>}</p></form></main></PageShell>;
}


function PublicNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="public-nav">
      <div className="nav-inner">
        <Logo />
        <nav className={`nav-links ${menuOpen ? 'nav-links-open' : ''}`} aria-label="Main navigation">
          <a href="#method" data-testid="link-method">How it works</a>
          <a href="#difference" data-testid="link-clarity">Why CampusOne</a>
          <Link href="/sign-in">Log in</Link>
          <Link href="/sign-up" className="nav-cta" data-testid="link-start-nav">Build My Financial Twin <ArrowRight size={15} /></Link>
        </nav>
        <button className="mobile-menu-button" onClick={() => setMenuOpen((open) => !open)} aria-label="Toggle navigation" data-testid="button-toggle-navigation">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  );
}

function Home() {
  const [, setLocation] = useLocation();
  const { data: health, isPending: healthPending } = useHealthCheck();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [demoError, setDemoError] = useState('');
  const [demoPreview, setDemoPreview] = useState<SemesterSimulationResult | null>(null);
  const session = useGetAuthSession();
  const restore = useSimulateSemester();
  const demoPreviewMutation = useSimulateSemester();
  const restored = useRef(false);
  const previewStarted = useRef(false);

  useEffect(() => {
    if (restored.current || session.isPending || !session.data?.authenticated) return;
    restored.current = true;
    if (!session.data.profile) {
      setLocation('/setup');
      return;
    }
    restore.mutate({ data: session.data.profile }, {
      onSuccess: (result: SemesterSimulationResult) => {
        saveSimulation(result);
        setLocation('/dashboard');
      },
    });
  }, [session.isPending, session.data]);

  useEffect(() => {
    if (previewStarted.current || session.isPending || session.data?.authenticated) return;
    previewStarted.current = true;
    demoPreviewMutation.mutate({ data: ahmadDemoProfile }, {
      onSuccess: (result: SemesterSimulationResult) => setDemoPreview(result),
    });
  }, [session.isPending, session.data]);

  const previewValues = demoPreview ? [demoPreview.profile.currentBalance, ...demoPreview.monthlyBalances.map((month) => month.endingBalance)] : [];
  const previewMax = Math.max(...previewValues, 1);
  const previewMin = Math.min(...previewValues, 0);
  const previewRange = Math.max(previewMax - previewMin, 1);
  const previewPoints = previewValues.map((value, index) => {
    const x = previewValues.length > 1 ? (index / (previewValues.length - 1)) * 100 : 50;
    const y = 100 - (12 + ((value - previewMin) / previewRange) * 72);
    return `${x},${y}`;
  }).join(' ');
  const handleAhmadDemo = () => startAhmadDemo(setLocation, setDemoError);

  return (
    <PageShell className={reducedMotion ? 'reduce-motion' : ''}>
      <PublicNav />
      <main>
        <section className="hero-section">
          <div className="hero-glow" aria-hidden="true" />
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot" /> AI-powered financial wellness platform</div>
            <h1>See your semester<br /><em>before you live it.</em></h1>
            <p className="hero-subhead">Your Financial Digital Twin for University Life.</p>
            <p className="hero-lede">CampusOne predicts how tuition, income, expenses, and academic decisions could affect a student's finances throughout the semester — before financial pressure becomes a problem.</p>
            <div className="hero-actions">
              <button className="button button-primary button-large" onClick={handleAhmadDemo} data-testid="button-try-ahmad-demo">Explore Ahmad's Demo <ArrowRight size={17} /></button>
              <Link className="button button-outline button-large" href="/sign-up" data-testid="button-start-simulation">Build My Financial Twin</Link>
            </div>
            <small className="demo-caption">Pre-filled demo · No setup required</small>
            {demoError && <div className="form-error" role="alert">{demoError}</div>}
            <div className="trust-row">
              <span><ShieldCheck size={15} /> Private by design</span>
              <span><span className={`status-pip ${healthPending ? 'status-pip-loading' : health?.status === 'ok' ? '' : 'status-pip-muted'}`} /> {healthPending ? 'Checking systems' : health?.status === 'ok' ? 'Simulation engine ready' : 'Ready when you are'}</span>
            </div>
          </div>
          <div className="hero-visual" aria-label="Financial twin preview">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="twin-card hero-demo-card">
              <div className="twin-card-top"><span className="small-label">AHMAD · DEMO PROFILE</span><span className="live-chip"><span /> REAL ENGINE</span></div>
              <div className="hero-demo-profile"><strong>Computer Science</strong><span>15 Credit Hours</span></div>
              <div className="hero-demo-chart" aria-label="Ahmad's projected semester cash flow"><div className="hero-demo-zero" /><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={previewPoints} /></svg></div>
              <div className="hero-demo-metrics"><div><span>PROJECTED BALANCE</span><strong>{demoPreview ? money(demoPreview.finalProjectedBalance) : 'Calculating…'}</strong></div><div><span>FINANCIAL STATUS</span><strong className={demoPreview?.firstRiskMonth ? 'score-risk' : 'score-good'}>{demoPreview ? (demoPreview.firstRiskMonth ? 'At risk' : 'On track') : 'Loading'}</strong></div><div><span>RISK MONTH</span><strong>{demoPreview?.firstRiskMonth ? `Month ${demoPreview.firstRiskMonth}` : demoPreview ? 'None' : 'Calculating…'}</strong></div></div>
            </div>
          </div>
        </section>

        <section className="problem-section" id="difference">
          <div className="problem-intro"><span className="strip-kicker">WHY CAMPUSONE</span><h2>Students know what they have today.<br /><em>But will it last through the semester?</em></h2><p>Tuition, living expenses, income, and academic decisions affect the same semester — but students often evaluate them separately. CampusOne brings them together into one forward-looking Financial Twin.</p></div>
          <div className="budgeting-comparison">
            <div><span>TRADITIONAL BUDGETING</span><strong>“Where did my money go?”</strong></div>
            <div><span>CAMPUSONE</span><strong>“Will my money last through the semester — and what can I do before it doesn't?”</strong></div>
          </div>
          <div className="difference-points"><div><strong>Forward-looking</strong><span>Predict financial pressure early.</span></div><div><strong>Academic + financial</strong><span>See the financial impact of academic decisions.</span></div><div><strong>Actionable</strong><span>Move from prediction to action and support.</span></div></div>
        </section>

        <section className="method-section" id="method">
          <div className="section-intro"><span className="eyebrow">How CampusOne works</span><h2>From prediction<br /><em>to action.</em></h2></div>
          <div className="method-grid">
            <MethodStep number="01" title="Predict" copy="Forecast semester cash flow." icon={<Compass size={21} />} />
            <MethodStep number="02" title="Simulate" copy="Test decisions with FutureMe." icon={<LineChart size={21} />} />
            <MethodStep number="03" title="Optimize" copy="Build a better semester plan." icon={<BarChart3 size={21} />} />
            <MethodStep number="04" title="Access support" copy="Discover relevant support and opportunities." icon={<BriefcaseBusiness size={21} />} />
            <MethodStep number="05" title="Recalculate" copy="See the updated financial outcome." icon={<RotateCcw size={21} />} />
          </div>
        </section>

        <section className="ecosystem-section">
          <div className="ecosystem-heading"><span className="eyebrow">One Financial Wellness Ecosystem</span><h2>Built for students.<br /><em>Valuable for universities and companies.</em></h2><p>CampusOne connects financial decision-making, institutional insight, and student opportunities in one ecosystem.</p></div>
          <div className="ecosystem-grid ecosystem-grid-three">
            <Link href="/sign-up" className="ecosystem-card" data-testid="ecosystem-student">
              <span className="strip-kicker">STUDENTS</span>
              <p>Understand your semester before financial pressure becomes a problem.</p>
              <span className="ecosystem-link">Build My Financial Twin <ArrowRight size={14} /></span>
            </Link>
            <Link href="/institution" className="ecosystem-card" data-testid="ecosystem-university">
              <span className="strip-kicker">UNIVERSITIES</span>
              <p>Understand aggregated financial wellness and student support needs.</p>
              <span className="ecosystem-link">Explore University Dashboard <ArrowRight size={14} /></span>
            </Link>
            <Link href="/company" className="ecosystem-card" data-testid="ecosystem-company">
              <span className="strip-kicker">COMPANIES</span>
              <p>Create internships and paid opportunities for student talent.</p>
              <span className="ecosystem-link">Explore Company Portal <ArrowRight size={14} /></span>
            </Link>
          </div>
          <div className="final-cta"><h2>See your semester before you live it.</h2><div className="final-cta-actions"><Link className="button button-primary" href="/sign-up" data-testid="button-start-bottom">Build My Financial Twin <ArrowRight size={17} /></Link></div></div>
        </section>
      </main>
      <footer className="public-footer"><Logo /><div><span>© 2026 CampusOne</span><button className="footer-motion" onClick={() => setReducedMotion((value) => !value)} data-testid="button-toggle-motion">{reducedMotion ? 'Motion off' : 'Motion on'}</button></div></footer>
    </PageShell>
  );
}

function MethodStep({ number, title, copy, icon }: { number: string; title: string; copy: string; icon: ReactNode }) {
  return <article className="method-step"><div className="step-top"><span>{number}</span><div className="step-icon">{icon}</div></div><h3>{title}</h3><p>{copy}</p></article>;
}

type FormValues = {
  name: string;
  major: string;
  creditHours: string;
  costPerCredit: string;
  semesterDuration: string;
  currentBalance: string;
  monthlyIncome: string;
  transportation: string;
  food: string;
  otherExpenses: string;
  tuitionMonth1: string;
  tuitionAmount1: string;
  tuitionMonth2: string;
  tuitionAmount2: string;
  tuitionMonth3: string;
  tuitionAmount3: string;
};

const defaultForm: FormValues = {
  name: 'Ahmad', major: 'Computer Science', creditHours: '15', costPerCredit: '50', semesterDuration: '5',
  currentBalance: '1050', monthlyIncome: '100', transportation: '70', food: '90', otherExpenses: '40',
  tuitionMonth1: '1', tuitionAmount1: '300', tuitionMonth2: '3', tuitionAmount2: '450', tuitionMonth3: '', tuitionAmount3: '',
};

function formFromProfile(profile: SemesterSimulationInput): FormValues {
  const payments = [...profile.tuitionPayments, { month: 0, amount: 0 }, { month: 0, amount: 0 }, { month: 0, amount: 0 }];
  return {
    name: profile.name,
    major: profile.major,
    creditHours: String(profile.creditHours),
    costPerCredit: String(profile.costPerCredit),
    semesterDuration: String(profile.semesterDuration),
    currentBalance: String(profile.currentBalance),
    monthlyIncome: String(profile.monthlyIncome),
    transportation: String(profile.transportation),
    food: String(profile.food),
    otherExpenses: String(profile.otherExpenses),
    tuitionMonth1: payments[0]?.month ? String(payments[0].month) : '',
    tuitionAmount1: payments[0]?.amount ? String(payments[0].amount) : '',
    tuitionMonth2: payments[1]?.month ? String(payments[1].month) : '',
    tuitionAmount2: payments[1]?.amount ? String(payments[1].amount) : '',
    tuitionMonth3: payments[2]?.month ? String(payments[2].month) : '',
    tuitionAmount3: payments[2]?.amount ? String(payments[2].amount) : '',
  };
}

function Setup() {
  const [, setLocation] = useLocation();
  const mutation = useSimulateSemester();
  const session = useGetAuthSession();
  const saveProfile = useSaveStudentProfile();
  const [values, setValues] = useState<FormValues>(defaultForm);
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');

  const update = (key: keyof FormValues, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const numberValue = (key: keyof FormValues) => Number(values[key]) || 0;
  const canContinue = values.name.trim().length > 0 && values.major.trim().length > 0;

  useEffect(() => {
    if (session.data?.profile) setValues(formFromProfile(session.data.profile));
    else if (session.data?.user) setValues((current) => ({ ...current, name: session.data?.user?.name ?? current.name }));
  }, [session.data]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!canContinue) {
      setError('Add your name and major to continue.');
      setStep(1);
      return;
    }
    const tuitionPayments = [1, 2, 3]
      .map((index) => ({ month: numberValue(`tuitionMonth${index}` as keyof FormValues), amount: numberValue(`tuitionAmount${index}` as keyof FormValues) }))
      .filter((payment) => payment.month > 0 && payment.amount > 0);
    const input: SemesterSimulationInput = {
      name: values.name.trim(), major: values.major.trim(), creditHours: numberValue('creditHours'), costPerCredit: numberValue('costPerCredit'),
      semesterDuration: Math.min(12, Math.max(1, numberValue('semesterDuration'))), currentBalance: numberValue('currentBalance'),
      monthlyIncome: numberValue('monthlyIncome'), transportation: numberValue('transportation'), food: numberValue('food'),
      otherExpenses: numberValue('otherExpenses'), tuitionPayments,
    };
    mutation.mutate({ data: input }, {
      onSuccess: (result: SemesterSimulationResult) => {
        saveSimulation(result);
        window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
        window.localStorage.removeItem(APPLIED_PLAN_STORAGE_KEY);
        window.localStorage.removeItem(OPPORTUNITY_STORAGE_KEY);
        if (session.data?.authenticated) {
          saveProfile.mutate({ data: input }, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['/api/auth/session'] });
              setLocation('/dashboard');
            },
            onError: () => setError('Your forecast is ready, but the permanent profile could not be saved. Please try again.'),
          });
        } else {
          setLocation('/dashboard');
        }
      },
      onError: () => setError('We could not run that forecast just now. Check your connection and try again.'),
    });
  };

  return (
    <PageShell className="setup-page">
      <header className="setup-nav"><Logo /><div className="setup-progress"><span className={step >= 1 ? 'active' : ''}>01</span><i /><span className={step >= 2 ? 'active' : ''}>02</span><i /><span className={step >= 3 ? 'active' : ''}>03</span></div><Link href="/" className="close-setup" data-testid="link-close-setup"><X size={19} /></Link></header>
      <main className="setup-main">
        <div className="setup-heading"><span className="eyebrow">Build your financial twin</span><h1>Tell us the shape<br />of your <em>semester.</em></h1><p>Use your best estimate. This is a private forecast, not a test.</p></div>
        <form className="setup-form" onSubmit={submit}>
          <div className={`form-panel ${step === 1 ? 'panel-visible' : ''}`}>
            <div className="panel-heading"><span className="panel-number">01</span><div><h2>Your academic context</h2><p>We use this to give your forecast a little more meaning.</p></div></div>
            <div className="field-grid">
              <Field label="Your name" value={values.name} onChange={(value) => update('name', value)} placeholder="e.g. Maya" testId="input-name" />
              <Field label="Major or program" value={values.major} onChange={(value) => update('major', value)} placeholder="e.g. Environmental design" testId="input-major" />
              <Field label="Credit hours" value={values.creditHours} onChange={(value) => update('creditHours', value)} type="number" suffix="credits" testId="input-credit-hours" />
              <Field label="Cost per credit" value={values.costPerCredit} onChange={(value) => update('costPerCredit', value)} type="number" suffix="JOD" testId="input-cost-per-credit" />
              <Field label="Semester duration" value={values.semesterDuration} onChange={(value) => update('semesterDuration', value)} type="number" suffix="months" testId="input-semester-duration" />
            </div>
            <div className="panel-actions"><span className="field-hint">All numbers can be adjusted later.</span><button type="button" className="button button-primary" onClick={() => canContinue ? setStep(2) : setError('Add your name and major to continue.')} data-testid="button-next-academic">Next: money snapshot <ArrowRight size={16} /></button></div>
          </div>

          <div className={`form-panel ${step === 2 ? 'panel-visible' : ''}`}>
            <div className="panel-heading"><span className="panel-number">02</span><div><h2>Your money snapshot</h2><p>A simple monthly picture — rounded numbers are welcome.</p></div></div>
            <div className="field-grid">
              <Field label="Current balance" value={values.currentBalance} onChange={(value) => update('currentBalance', value)} type="number" suffix="JOD" testId="input-current-balance" />
              <Field label="Monthly income" value={values.monthlyIncome} onChange={(value) => update('monthlyIncome', value)} type="number" suffix="JOD" testId="input-monthly-income" />
              <Field label="Food" value={values.food} onChange={(value) => update('food', value)} type="number" suffix="JOD" testId="input-food" />
              <Field label="Transportation" value={values.transportation} onChange={(value) => update('transportation', value)} type="number" suffix="JOD" testId="input-transportation" />
              <Field label="Other monthly expenses" value={values.otherExpenses} onChange={(value) => update('otherExpenses', value)} type="number" suffix="JOD" testId="input-other-expenses" />
            </div>
            <div className="panel-actions"><button type="button" className="button button-quiet" onClick={() => setStep(1)} data-testid="button-back-academic"><ChevronLeft size={16} /> Back</button><button type="button" className="button button-primary" onClick={() => setStep(3)} data-testid="button-next-tuition">Next: tuition timing <ArrowRight size={16} /></button></div>
          </div>

          <div className={`form-panel ${step === 3 ? 'panel-visible' : ''}`}>
            <div className="panel-heading"><span className="panel-number">03</span><div><h2>Tuition, on your timeline</h2><p>When are the larger payments likely to leave your account?</p></div></div>
            <div className="tuition-table"><div className="tuition-header"><span>Payment</span><span>Month</span><span>Amount</span></div>{[1, 2, 3].map((index) => <div className="tuition-row" key={index}><span className="payment-name">{index === 1 ? 'First payment' : index === 2 ? 'Second payment' : 'Third payment'}<small>{index === 1 ? 'Required' : 'Optional'}</small></span><div className="input-with-suffix"><input type="number" min="1" max="12" value={values[`tuitionMonth${index}` as keyof FormValues]} onChange={(event) => update(`tuitionMonth${index}` as keyof FormValues, event.target.value)} placeholder="—" data-testid={`input-tuition-month-${index}`} /><span>mo.</span></div><div className="input-with-prefix"><span>JOD</span><input type="number" min="0" value={values[`tuitionAmount${index}` as keyof FormValues]} onChange={(event) => update(`tuitionAmount${index}` as keyof FormValues, event.target.value)} placeholder="0" data-testid={`input-tuition-amount-${index}`} /></div></div>)}</div>
            <div className="panel-actions"><button type="button" className="button button-quiet" onClick={() => setStep(2)} data-testid="button-back-money"><ChevronLeft size={16} /> Back</button><button type="submit" className="button button-primary" disabled={mutation.isPending || saveProfile.isPending} data-testid="button-run-simulation">{mutation.isPending || saveProfile.isPending ? <><LoaderCircle size={16} className="spin" /> {saveProfile.isPending ? 'Saving your profile' : 'Building your twin'}</> : <>{session.data?.authenticated ? 'Save profile & show forecast' : 'Show my forecast'} <ArrowRight size={16} /></>}</button></div>
          </div>
          {error && <div className="form-error" role="alert" data-testid="status-setup-error"><CircleAlert size={17} /> {error}</div>}
        </form>
        <div className="setup-note"><LockKeyhole size={14} /> {session.data?.authenticated ? 'Your profile is saved to your account. Temporary scenarios do not overwrite it.' : 'Ahmad Demo stays in this browser. CampusOne does not ask for bank access.'}</div>
      </main>
    </PageShell>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', prefix, suffix, testId }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; prefix?: string; suffix?: string; testId: string }) {
  return <label className="field"><span>{label}</span><div className={`field-control ${prefix ? 'has-prefix' : ''} ${suffix ? 'has-suffix' : ''}`}>{prefix && <b>{prefix}</b>}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} min={type === 'number' ? 0 : undefined} data-testid={testId} />{suffix && <small>{suffix}</small>}</div></label>;
}

const journeySteps = ['Predict', 'Simulate', 'Optimize', 'Access Support', 'Updated Plan'];

function JourneyIndicator({ activeStep }: { activeStep: number }) {
  return <div className="journey-indicator" aria-label="CampusOne decision journey">{journeySteps.map((step, index) => <div key={step} className={`journey-step ${index < activeStep ? 'journey-complete' : ''} ${index === activeStep ? 'journey-active' : ''}`}><span>{index < activeStep ? <CircleCheck size={12} /> : index + 1}</span><strong>{step}</strong></div>)}</div>;
}

function Dashboard() {
  const [, setLocation] = useLocation();
  const [simulation, setSimulation] = useState<SemesterSimulationResult | null>(() => loadSimulation());
  const [activeMonth, setActiveMonth] = useState(0);

  useEffect(() => {
    const onStorage = () => setSimulation(loadSimulation());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  if (!simulation) return <EmptyDashboard onStart={() => setLocation('/setup')} />;

  const profile = simulation.profile;
  const activeForecast = simulation.monthlyBalances[activeMonth] ?? simulation.monthlyBalances[0];
  const monthlyLiving = profile.food + profile.transportation + profile.otherExpenses;
  const netMonthly = profile.monthlyIncome - monthlyLiving;
  const hasRisk = simulation.firstRiskMonth !== null;
  const appliedPlan = loadAppliedPlan(simulation);
  const updatedPlan = loadUpdatedPlan(simulation);
  const isUpdatedPlan = Boolean(updatedPlan || appliedPlan);
  const planBefore = updatedPlan?.before ?? appliedPlan?.before ?? null;
  const updatedOutcome = updatedPlan && planBefore
    ? planBefore.lowestProjectedBalance < 0 && updatedPlan.after.lowestProjectedBalance >= 0
      ? 'Semester Plan Stabilized'
      : updatedPlan.after.lowestProjectedBalance > planBefore.lowestProjectedBalance
        ? 'Financial Gap Reduced'
        : updatedPlan.after.firstRiskMonth ? 'Financial gap remains' : 'Plan remains stable'
    : null;
  const chartValues = [profile.currentBalance, ...simulation.monthlyBalances.map((month) => month.endingBalance)];
  const chartMaximum = Math.max(...chartValues, 1);
  const chartMinimum = Math.min(...chartValues, 0);
  const chartRange = Math.max(chartMaximum - chartMinimum, 1);
  const zeroPosition = 12 + ((0 - chartMinimum) / chartRange) * 72;
  const chartPoints = chartValues.map((value, index) => {
    const x = chartValues.length > 1 ? (index / (chartValues.length - 1)) * 100 : 50;
    const position = 12 + ((value - chartMinimum) / chartRange) * 72;
    return `${x},${100 - position}`;
  }).join(' ');

  return (
    <PageShell className="dashboard-page">
      <header className="dash-nav"><Logo /><nav><Link href="/dashboard" className="dash-nav-active" data-testid="link-dashboard">Financial Twin</Link><Link href="/futureme" className="dash-nav-link" data-testid="link-futureme">FutureMe</Link><Link href="/opportunities" className="dash-nav-link" aria-label="Opportunities">Access Support</Link><Link href="/institution" className="dash-nav-link" aria-label="Institution View">University Portal</Link><button className="dash-nav-link" onClick={() => setLocation('/setup')} data-testid="button-edit-twin">Edit twin</button></nav><AccountBadge fallbackName={profile.name} /></header>
      <main className="dashboard-main">
        <JourneyIndicator activeStep={isUpdatedPlan ? 4 : 0} />
        {updatedPlan && planBefore ? <section className="updated-plan-context" aria-label="Updated semester plan" data-testid="updated-plan-context"><div className="updated-plan-context-heading"><div><span className="eyebrow">Updated Financial Twin</span><h2>Your Updated Semester Plan</h2><p>Here’s how your semester looks after the decisions you explored.</p></div><strong>{updatedOutcome}</strong></div><div className="updated-plan-comparison"><div><span>Original Projection</span><strong>{money(planBefore.finalProjectedBalance)}</strong><small>Health {planBefore.financialHealthScore}/100 · {planBefore.firstRiskMonth ? `Risk Month ${planBefore.firstRiskMonth}` : 'No risk'}</small></div><ArrowRight size={18} /><div><span>Updated Projection</span><strong>{money(simulation.finalProjectedBalance)}</strong><small>Health {simulation.financialHealthScore}/100 · {simulation.firstRiskMonth ? `Risk Month ${simulation.firstRiskMonth}` : 'No risk'}</small></div></div></section> : appliedPlan && <section className="updated-plan-banner" aria-label="Applied semester plan"><CircleCheck size={18} /><div><span className="eyebrow">Updated plan applied</span><strong>Your Financial Twin now reflects the selected Fix My Semester assumptions.</strong></div><span>{money(appliedPlan.selected.result.finalProjectedBalance - appliedPlan.before.finalProjectedBalance)} improvement</span></section>}
        <div className="dashboard-heading demo-heading"><div><span className="eyebrow">Financial Twin · {profile.name === 'Ahmad' ? 'Demo Profile' : 'Student Profile'}</span><h1>{profile.major} student.<br /><em>{profile.creditHours} credit hours.</em></h1><p>See how your finances are projected to change throughout the semester. Your current plan maps the next {profile.semesterDuration} months.</p></div><button className="button button-outline" onClick={() => setLocation('/setup')} data-testid="button-rerun-simulation"><RotateCcw size={15} /> Update student data</button></div>

        <section className="overview-hero">
          <article className={`prediction-hero ${hasRisk ? 'prediction-risk' : ''}`}>
            <div className="card-kicker"><span>PROJECTED SEMESTER BALANCE</span><WalletCards size={18} /></div>
            <div className="prediction-value">{money(simulation.finalProjectedBalance)}</div>
            <div className="prediction-status"><span className={hasRisk ? 'status-risk' : 'status-steady'}>{hasRisk ? 'Financial gap projected' : 'Plan remains above zero'}</span><span>Health {simulation.financialHealthScore}/100</span></div>
            <p>CampusOne projects the problem before your balance runs out, giving you time to compare a better decision.</p>
          </article>
          <article className={`risk-summary ${hasRisk ? 'risk-summary-alert' : ''}`}>
            <span className="risk-summary-icon">{hasRisk ? <CircleAlert size={22} /> : <CircleCheck size={22} />}</span>
            <span className="eyebrow">Risk begins</span>
            <strong>{hasRisk ? `Month ${simulation.firstRiskMonth}` : 'No risk detected'}</strong>
            <p>{hasRisk ? `Your balance first crosses below zero in Month ${simulation.firstRiskMonth}.` : 'The current forecast stays positive through semester end.'}</p>
          </article>
        </section>

        <section className="section-heading-row runway-heading"><div><span className="eyebrow">Semester cash-flow trajectory</span><h2>See exactly where the balance crosses zero.</h2></div><div className="timeline-controls"><button onClick={() => setActiveMonth((month) => Math.max(0, month - 1))} disabled={activeMonth === 0} aria-label="Previous month"><ChevronLeft size={17} /></button><span>{activeForecast.label}</span><button onClick={() => setActiveMonth((month) => Math.min(simulation.monthlyBalances.length - 1, month + 1))} disabled={activeMonth === simulation.monthlyBalances.length - 1} aria-label="Next month"><ChevronRight size={17} /></button></div></section>
        <section className="cashflow-card">
          <div className="cashflow-plot"><div className="cashflow-zero" style={{ bottom: `${zeroPosition}%` }}><span>0 JOD</span></div><svg className="cashflow-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points={chartPoints} /></svg>{chartValues.map((value, index) => {
            const position = 12 + ((value - chartMinimum) / chartRange) * 72;
            const isRisk = value < 0;
            const horizontalPosition = chartValues.length > 1 ? (index / (chartValues.length - 1)) * 100 : 50;
            return <button key={index} className={`cashflow-point ${isRisk ? 'cashflow-point-risk' : ''} ${index - 1 === activeMonth ? 'cashflow-point-active' : ''}`} style={{ top: `${100 - position}%`, left: `${horizontalPosition}%` }} onClick={() => index > 0 && setActiveMonth(index - 1)} disabled={index === 0} aria-label={`${index === 0 ? 'Starting balance' : `Month ${index}`}: ${money(value)}`}><i /><span>{index === 0 ? 'Now' : `M${index}`}</span><strong>{money(value)}</strong></button>;
          })}</div>
          <div className="cashflow-detail"><div><span className="eyebrow">{activeForecast.label}</span><h3>{activeForecast.isAtRisk ? 'The forecast is below zero here.' : 'The plan still has breathing room here.'}</h3></div><div><span>Starting <strong>{money(activeForecast.startingBalance)}</strong></span><span>Ending <strong className={activeForecast.isAtRisk ? 'negative' : 'positive'}>{money(activeForecast.endingBalance)}</strong></span></div></div>
        </section>

        <section className="drivers-section">
          <div className="section-heading-row"><div><span className="eyebrow">Why is this happening?</span><h2>Four numbers explain the forecast.</h2></div></div>
          <div className="driver-grid">
            <article><GraduationCap size={18} /><span>Tuition</span><strong>{money(simulation.tuition)}</strong><small>{profile.creditHours} credits × {money(profile.costPerCredit)}</small></article>
            <article><DollarSign size={18} /><span>Monthly income</span><strong>{money(profile.monthlyIncome)}</strong><small>{money(simulation.totalIncome)} across the semester</small></article>
            <article><WalletCards size={18} /><span>Monthly living expenses</span><strong>{money(monthlyLiving)}</strong><small>Food, transport, and other costs</small></article>
            <article className={netMonthly < 0 ? 'driver-alert' : ''}><LineChart size={18} /><span>Net monthly cash flow</span><strong>{netMonthly >= 0 ? '+' : ''}{money(netMonthly)}</strong><small>Before scheduled tuition payments</small></article>
          </div>
        </section>

        <section className="overview-next-step">
          <div><span className="eyebrow">Next in your journey</span><h2>Test a decision before making it.</h2><p>FutureMe uses this exact Financial Twin to show how credits, income, and expenses could change the semester.</p></div>
          <button className="button button-primary button-large" onClick={() => { saveActiveScenario(simulation, controlsFromResult(simulation), simulation, 'baseline'); setLocation('/futureme'); }} data-testid="button-simulate-decision">Simulate a Decision <ArrowRight size={17} /></button>
        </section>
        {appliedPlan && <section className="support-next-step"><div><span className="eyebrow">Access support</span><h2>Match this plan with real opportunities.</h2><p>Use the applied plan’s exact income and tuition-support targets to review sourced aid, scholarships, and paid opportunities.</p></div><button className="button button-dark" onClick={() => { saveOpportunityPlan({ ...appliedPlan, returnTo: '/dashboard' }); setLocation('/opportunities'); }} data-testid="button-match-applied-plan">Find Opportunities <ArrowRight size={16} /></button></section>}
        <div className="dashboard-disclaimer"><ShieldCheck size={15} /> Every result comes from the same Financial Twin simulation engine.</div>
      </main>
    </PageShell>
  );
}

function FutureMe() {
  const [, setLocation] = useLocation();
  const baseline = useMemo(() => loadSimulation(), []);
  const savedScenario = useMemo(() => baseline ? loadActiveScenario(baseline) : null, [baseline]);
  const mutation = useSimulateSemester();
  const [scenario, setScenario] = useState<ScenarioControls | null>(() => {
    if (savedScenario) return savedScenario.controls;
    const saved = baseline;
    if (!saved) return null;
    return {
      creditHours: saved.profile.creditHours,
      monthlyIncome: saved.profile.monthlyIncome,
      monthlyExpenses: saved.profile.food + saved.profile.transportation + saved.profile.otherExpenses,
      costPerCredit: saved.profile.costPerCredit,
    };
  });
  const [scenarioSimulation, setScenarioSimulation] = useState<SemesterSimulationResult | null>(savedScenario?.result ?? baseline);
  const [activeMonth, setActiveMonth] = useState(0);
  const [scenarioError, setScenarioError] = useState('');
  const [isScenarioSyncing, setIsScenarioSyncing] = useState(false);
  const [syncedScenarioVersion, setSyncedScenarioVersion] = useState(0);
  const scenarioVersion = useRef(0);

  const scenarioProfile = useMemo(() => {
    if (!baseline || !scenario) return null;
    const base = baseline.profile;
    const baseExpenses = base.food + base.transportation + base.otherExpenses;
    const multiplier = baseExpenses > 0 ? scenario.monthlyExpenses / baseExpenses : 1;
    const scenarioTuition = scenario.creditHours * scenario.costPerCredit;
    const tuitionMultiplier = baseline.tuition > 0 ? scenarioTuition / baseline.tuition : 1;
    return {
      ...base,
      creditHours: scenario.creditHours,
      monthlyIncome: scenario.monthlyIncome,
      costPerCredit: scenario.costPerCredit,
      food: base.food * multiplier,
      transportation: base.transportation * multiplier,
      otherExpenses: base.otherExpenses * multiplier,
      tuitionPayments: base.tuitionPayments.map((payment) => ({
        ...payment,
        amount: payment.amount * tuitionMultiplier,
      })),
    };
  }, [baseline, scenario]);

  useEffect(() => {
    if (!scenarioProfile || !baseline || !scenario) return;
    const requestVersion = scenarioVersion.current;
    setIsScenarioSyncing(true);
    const timer = window.setTimeout(() => {
      mutation.mutate({ data: scenarioProfile }, {
        onSuccess: (result: SemesterSimulationResult) => {
          if (requestVersion !== scenarioVersion.current) return;
          setScenarioSimulation(result);
          saveActiveScenario(baseline, scenario, result);
          setScenarioError('');
          setIsScenarioSyncing(false);
          setSyncedScenarioVersion(requestVersion);
        },
        onError: () => {
          if (requestVersion !== scenarioVersion.current) return;
          setScenarioError('The forecast could not refresh. Please try again.');
          setIsScenarioSyncing(false);
        },
      });
    }, 140);
    return () => window.clearTimeout(timer);
  }, [baseline, scenario, scenarioProfile]);

  if (!baseline || !scenario || !scenarioProfile || !scenarioSimulation) {
    return <EmptyDashboard onStart={() => setLocation('/setup')} />;
  }

  const current = baseline;
  const future = scenarioSimulation;
  const currentMonthlyExpenses = current.profile.food + current.profile.transportation + current.profile.otherExpenses;
  const futureMonthlyExpenses = future.profile.food + future.profile.transportation + future.profile.otherExpenses;
  const tuitionDelta = future.tuition - current.tuition;
  const balanceDelta = future.finalProjectedBalance - current.finalProjectedBalance;
  const scoreDelta = future.financialHealthScore - current.financialHealthScore;
  const createsPressure = future.financialHealthScore < current.financialHealthScore || future.finalProjectedBalance < current.finalProjectedBalance || (future.firstRiskMonth !== null && current.firstRiskMonth === null);
  const activeCurrent = current.monthlyBalances[activeMonth];
  const activeFuture = future.monthlyBalances[activeMonth];

  const setScenarioValue = (key: keyof ScenarioControls, value: string) => {
    scenarioVersion.current += 1;
    setIsScenarioSyncing(true);
    setScenario((previous) => previous ? { ...previous, [key]: Number(value) || 0 } : previous);
  };

  const resetScenario = () => {
    scenarioVersion.current += 1;
    setIsScenarioSyncing(true);
    setScenario({ creditHours: current.profile.creditHours, monthlyIncome: current.profile.monthlyIncome, monthlyExpenses: currentMonthlyExpenses, costPerCredit: current.profile.costPerCredit });
  };
  const hasMatchingScenario = syncedScenarioVersion === scenarioVersion.current && !scenarioError;

  return (
    <PageShell className="futureme-page">
      <header className="dash-nav"><Logo /><nav><Link href="/dashboard" className="dash-nav-link" data-testid="link-dashboard-from-futureme">Financial Twin</Link><Link href="/futureme" className="dash-nav-active" data-testid="link-futureme-active">FutureMe</Link><Link href="/opportunities" className="dash-nav-link" aria-label="Opportunities">Access Support</Link><Link href="/institution" className="dash-nav-link" aria-label="Institution View">University Portal</Link><button className="dash-nav-link" onClick={() => setLocation('/setup')} data-testid="button-edit-twin-futureme">Edit twin</button></nav><div className="dash-user"><span className="user-avatar">{current.profile.name.slice(0, 1).toUpperCase()}</span><span>{current.profile.name}</span></div></header>
      <main className="futureme-main">
        <JourneyIndicator activeStep={1} />
        <div className="futureme-heading">
          <div>
            <span className="eyebrow"><Scale size={14} /> FutureMe · Decision simulator</span>
            <h1>Explore Your <em>Future.</em></h1>
            <p>Test a decision before making it. See how today's academic decisions could affect your financial semester.</p>
          </div>
          <div className="futureme-heading-actions">
            <span className={`refresh-status ${isScenarioSyncing ? 'refresh-status-pending' : ''} ${scenarioError ? 'refresh-status-error' : ''}`}><span /> {scenarioError ? 'Refresh failed' : isScenarioSyncing ? 'Updating forecast' : 'Forecast synced'}</span>
            <button className="button button-outline" onClick={resetScenario} data-testid="button-reset-scenario"><RotateCcw size={15} /> Reset scenario</button>
          </div>
        </div>

        <section className="futureme-hero-grid">
          <article className="scenario-controls-card">
            <div className="card-title-row"><div><span className="eyebrow">Try a decision</span><h2>What if this changes?</h2></div><Sparkles size={20} /></div>
            <p className="scenario-card-copy">Move one input at a time. FutureMe recalculates the same financial twin engine after every change.</p>
            <div className="scenario-controls">
              <fieldset className="scenario-control scenario-credit-control"><legend>Credit hours</legend><div className="credit-quick-options">{[12, 15, 18].map((credits) => <button type="button" key={credits} className={scenario.creditHours === credits ? 'active' : ''} aria-pressed={scenario.creditHours === credits} onClick={() => setScenarioValue('creditHours', String(credits))} data-testid={`button-scenario-credits-${credits}`}>{credits}</button>)}</div><div className="scenario-range"><input id="scenario-credit-range" aria-label="Credit hours from 9 to 21" type="range" min="9" max="21" step="1" value={scenario.creditHours} onChange={(event) => setScenarioValue('creditHours', event.target.value)} data-testid="range-scenario-credits" /><strong aria-live="polite">{scenario.creditHours} credits</strong></div><small>Choose 9–21 credits. Tuition updates automatically.</small></fieldset>
              <label className="scenario-control"><span>Monthly income</span><div className="scenario-input"><input type="number" min="0" value={scenario.monthlyIncome} onChange={(event) => setScenarioValue('monthlyIncome', event.target.value)} data-testid="input-scenario-income" /><b>JOD</b></div><small>Scholarships, work, or family support.</small></label>
              <label className="scenario-control"><span>Monthly living expenses</span><div className="scenario-input"><input type="number" min="0" value={scenario.monthlyExpenses} onChange={(event) => setScenarioValue('monthlyExpenses', event.target.value)} data-testid="input-scenario-expenses" /><b>JOD</b></div><small>Food, transport, and other costs combined.</small></label>
              <label className="scenario-control"><span>Cost per credit</span><div className="scenario-input"><input type="number" min="0" value={scenario.costPerCredit} onChange={(event) => setScenarioValue('costPerCredit', event.target.value)} data-testid="input-scenario-cost" /><b>JOD</b></div><small>Change the tuition assumption.</small></label>
            </div>
            {scenarioError && <div className="form-error" role="alert"><CircleAlert size={16} /> {scenarioError}</div>}
          </article>
          <article className={`scenario-signal-card ${createsPressure ? 'scenario-signal-risk' : 'scenario-signal-good'}`}>
            <div className="scenario-signal-orbit" aria-hidden="true" />
            <span className="eyebrow">{createsPressure ? 'Pressure detected' : 'Scenario looks steady'}</span>
            <h2>{createsPressure ? 'This decision could create a financial gap.' : 'This decision keeps your runway healthy.'}</h2>
            <p>{createsPressure ? `The scenario shifts your ending balance by ${moneyExact(balanceDelta)} and brings risk to ${future.firstRiskMonth ? `Month ${future.firstRiskMonth}` : 'the semester'}.` : 'Your projected balance and health score stay at or above your current plan.'}</p>
            <button className="button button-dark" disabled={isScenarioSyncing || !hasMatchingScenario} onClick={() => { saveActiveScenario(current, scenario, future, 'futureme'); setLocation('/fix-my-semester'); }} data-testid="button-optimize-scenario">Optimize This Scenario <ArrowRight size={16} /></button>
          </article>
        </section>

        <section className="comparison-section">
          <div className="section-heading-row"><div><span className="eyebrow">Side by side</span><h2>Current plan vs. future scenario.</h2></div><span className="comparison-note">Live comparison · {current.profile.semesterDuration} months</span></div>
          <div className="comparison-table">
            <div className="comparison-row comparison-header"><span>Metric</span><strong>Current plan</strong><strong>Future scenario</strong><span>Change</span></div>
            <div className="comparison-row"><span>Credit hours</span><strong>{current.profile.creditHours} credits</strong><strong>{future.profile.creditHours} credits</strong><span className={future.profile.creditHours >= current.profile.creditHours ? 'negative' : 'positive'}>{future.profile.creditHours - current.profile.creditHours >= 0 ? '+' : ''}{future.profile.creditHours - current.profile.creditHours}</span></div>
            <div className="comparison-row"><span>Tuition</span><strong>{money(current.tuition)}</strong><strong>{money(future.tuition)}</strong><span className={tuitionDelta > 0 ? 'negative' : 'positive'}>{tuitionDelta >= 0 ? '+' : ''}{money(tuitionDelta)}</span></div>
            <div className="comparison-row"><span>Monthly expenses</span><strong>{money(currentMonthlyExpenses)}</strong><strong>{money(futureMonthlyExpenses)}</strong><span className={futureMonthlyExpenses > currentMonthlyExpenses ? 'negative' : 'positive'}>{futureMonthlyExpenses >= currentMonthlyExpenses ? '+' : ''}{money(futureMonthlyExpenses - currentMonthlyExpenses)}</span></div>
            <div className="comparison-row comparison-emphasis"><span>Projected final balance</span><strong>{money(current.finalProjectedBalance)}</strong><strong className={future.finalProjectedBalance < 0 ? 'negative' : 'positive'}>{money(future.finalProjectedBalance)}</strong><span className={balanceDelta < 0 ? 'negative' : 'positive'}>{balanceDelta >= 0 ? '+' : ''}{money(balanceDelta)}</span></div>
            <div className="comparison-row"><span>Financial health score</span><strong>{current.financialHealthScore}<small>/100</small></strong><strong>{future.financialHealthScore}<small>/100</small></strong><span className={scoreDelta < 0 ? 'negative' : 'positive'}>{scoreDelta >= 0 ? '+' : ''}{scoreDelta}</span></div>
            <div className="comparison-row"><span>Risk month</span><strong>{current.firstRiskMonth ? `Month ${current.firstRiskMonth}` : 'None'}</strong><strong className={future.firstRiskMonth ? 'negative' : 'positive'}>{future.firstRiskMonth ? `Month ${future.firstRiskMonth}` : 'None'}</strong><span>{future.firstRiskMonth === current.firstRiskMonth ? '—' : future.firstRiskMonth ? 'Earlier pressure' : 'Improved'}</span></div>
          </div>
        </section>

        <section className="future-timeline-section">
          <div className="section-heading-row"><div><span className="eyebrow">The semester in motion</span><h2>See where the decision lands.</h2></div><span className="comparison-note">Select a month for detail</span></div>
          <div className="future-timeline-card">
            <div className="future-timeline-header"><span>Month</span><span>Current plan</span><span>Future scenario</span><span>Difference</span></div>
            {current.monthlyBalances.map((month, index) => {
              const futureMonth = future.monthlyBalances[index];
              const difference = (futureMonth?.endingBalance ?? 0) - month.endingBalance;
              return <button key={month.month} className={`future-timeline-row ${index === activeMonth ? 'future-timeline-active' : ''} ${futureMonth?.isAtRisk ? 'future-timeline-risk' : ''}`} onClick={() => setActiveMonth(index)} data-testid={`button-futureme-month-${month.month}`}><span>{month.label}</span><strong>{money(month.endingBalance)}</strong><strong>{money(futureMonth?.endingBalance ?? 0)}</strong><span className={difference < 0 ? 'negative' : 'positive'}>{difference >= 0 ? '+' : ''}{money(difference)}</span></button>;
            })}
            <div className="future-timeline-detail"><div><span className="eyebrow">{activeFuture?.label ?? 'Selected month'}</span><h3>{activeFuture?.isAtRisk ? 'The scenario reaches a pressure point here.' : 'There is still room to move here.'}</h3></div><div className="future-detail-values"><span>Current <strong>{money(activeCurrent?.endingBalance ?? 0)}</strong></span><span>Scenario <strong className={activeFuture?.isAtRisk ? 'negative' : ''}>{money(activeFuture?.endingBalance ?? 0)}</strong></span></div></div>
          </div>
        </section>
      </main>
    </PageShell>
  );
}

const analysisSteps = ['Reviewing cash flow', 'Testing financial scenarios', 'Evaluating tuition flexibility', 'Checking support pathways', 'Comparing optimized plans'];

function DemoOpportunityMatcher({ scenario, financialNeed, limit = 4, onContinue, showContinue = true }: { scenario: SemesterSimulationResult; financialNeed: number; limit?: number; onContinue: (simulation: OpportunitySimulation | null) => void; showContinue?: boolean }) {
  const mutation = useSimulateSemester();
  const matches = useMemo(() => matchOpportunities(scenario.profile.major, financialNeed).slice(0, limit), [scenario.profile.major, financialNeed, limit]);
  const [selected, setSelected] = useState<OpportunityMatch | null>(matches[0] ?? null);
  const [simulation, setSimulation] = useState<OpportunitySimulation | null>(() => loadOpportunitySimulation(scenario));

  useEffect(() => {
    if (!matches.some((match) => match.id === selected?.id)) setSelected(matches[0] ?? null);
  }, [matches, selected?.id]);

  useEffect(() => {
    setSimulation(loadOpportunitySimulation(scenario));
  }, [scenario]);

  const simulate = () => {
    if (!selected) return;
    mutation.mutate({ data: { ...scenario.profile, monthlyIncome: scenario.profile.monthlyIncome + selected.value } }, {
      onSuccess: (after: SemesterSimulationResult) => {
        const next = { opportunity: selected, sourceProfile: scenario.profile, before: scenario, after };
        setSimulation(next);
        window.localStorage.setItem(OPPORTUNITY_STORAGE_KEY, JSON.stringify(next));
      },
    });
  };

  return <section className="opportunity-matcher" aria-label="Opportunity Matcher"><div className="section-heading-row"><div><span className="eyebrow">Access Support · Demo Opportunities</span><h2>Match the plan to practical student work.</h2><p>{financialNeed > 0 ? `${money(financialNeed)} remains at the lowest point of this plan.` : 'You’re currently on track financially. You can still explore opportunities that may strengthen your semester.'}</p></div><span className="match-disclaimer">Demo Opportunity · not a live job or eligibility decision</span></div><div className="opportunity-layout"><div className="opportunity-list">{matches.map((opportunity) => <button key={opportunity.id} className={selected?.id === opportunity.id ? 'opportunity-selected' : ''} onClick={() => { setSelected(opportunity); setSimulation(null); }} data-testid={`button-opportunity-${opportunity.id}`}><span><b>Demo Opportunity · {opportunity.type}</b><small>{opportunity.availability}</small></span><strong>{opportunity.title}</strong><small>{opportunity.provider} · {opportunity.workMode} · {opportunity.hours}</small><div><span>{opportunity.matchScore}% Match</span><span>{money(opportunity.value)} / month</span></div></button>)}</div>{selected && <article className="opportunity-detail"><div><span className="eyebrow">Demo Opportunity</span><h3>{selected.title}</h3><p>{selected.description}</p></div><dl><div><dt>Why it matches</dt><dd>{selected.whyItMatches}</dd></div><div><dt>Work details</dt><dd>{selected.workMode} · {selected.hours} · {selected.requiredSkills.join(', ')}</dd></div><div><dt>Academic requirement</dt><dd>{selected.academicRequirement}</dd></div><div><dt>Potential financial impact</dt><dd>{money(selected.value)} estimated monthly income · {financialNeed > 0 ? `up to ${money(selected.potentialImpact)} of the current gap in the first month` : 'compared with the current stable plan'}</dd></div></dl><button className="button button-primary" onClick={simulate} disabled={mutation.isPending} data-testid="button-simulate-opportunity">{mutation.isPending ? <><LoaderCircle size={16} className="spin" /> Recalculating</> : <>Simulate This Opportunity <ArrowRight size={16} /></>}</button><small className="opportunity-model-note">This simulation adds the estimated monthly income to the active scenario and recalculates through the Financial Twin. It is not a job listing, offer, award, or eligibility decision.</small>{simulation?.opportunity.id === selected.id && <div className="opportunity-result" data-testid="opportunity-result"><span><small>Before</small><strong>{money(simulation.before.finalProjectedBalance)}</strong></span><ArrowRight size={18} /><span><small>After engine recalculation</small><strong>{money(simulation.after.finalProjectedBalance)}</strong></span><p>{simulation.after.firstRiskMonth ? `${money(Math.max(0, -simulation.after.lowestProjectedBalance))} remains at the lowest point · risk in Month ${simulation.after.firstRiskMonth}` : 'The recalculated forecast remains at or above zero.'}</p></div>}</article>}</div>{showContinue && <div className="opportunity-next-step"><div><span className="eyebrow">Next in your journey</span><h3>Continue to Updated Plan</h3><p>{simulation ? 'Review the recalculated Financial Twin with this opportunity impact included.' : 'Continue with the active plan without adding opportunity income.'}</p></div><button className="button button-dark" onClick={() => onContinue(simulation)} data-testid="button-continue-updated-plan">Continue to Updated Plan <ArrowRight size={16} /></button></div>}</section>;
}
function OpportunityMatcher() {
  const [, setLocation] = useLocation();
  const plan = useMemo(() => loadOpportunityPlan(), []);
  const matcher = useMatchOpportunities();
  const [result, setResult] = useState<OpportunityMatchResult | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!plan || started.current) return;
    started.current = true;
    const targets = plan.selected.targets;
    matcher.mutate({
      data: {
        ...targets,
        semesterDuration: plan.selected.profile.semesterDuration,
        major: plan.selected.profile.major,
      },
    }, { onSuccess: (data: OpportunityMatchResult) => setResult(data) });
  }, [plan]);

  if (!plan) return <OpportunitiesPage />;
  const targets = plan.selected.targets;
  const combinedTarget = targets.tuitionSupportAmount + targets.semesterIncomeAmount;
  const continueToUpdatedPlan = (opportunity: OpportunitySimulation | null) => {
    const optimizedPlan: AppliedPlan = {
      before: plan.before,
      selected: plan.selected,
      interventions: plan.interventions,
    };
    const after = opportunity?.after ?? plan.selected.result;
    saveUpdatedPlan({ before: plan.before, after, optimizedPlan, opportunity });
    saveSimulation(after);
    window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
    window.localStorage.removeItem(OPPORTUNITY_PLAN_STORAGE_KEY);
    window.localStorage.removeItem(OPPORTUNITY_STORAGE_KEY);
    setLocation('/dashboard');
  };

  return <PageShell className="opportunity-page">
    <header className="dash-nav"><Logo /><nav><button className="dash-nav-link" onClick={() => { window.localStorage.removeItem(OPPORTUNITY_PLAN_STORAGE_KEY); setLocation(plan.returnTo); }} data-testid="button-back-from-opportunities"><ChevronLeft size={15} /> Back to plan</button></nav><div className="dash-user"><span className="user-avatar">{plan.selected.profile.name.slice(0, 1).toUpperCase()}</span><span>{plan.selected.profile.name}</span></div></header>
    <main className="opportunity-main">
      <JourneyIndicator activeStep={3} />
      <header className="opportunity-heading"><div><span className="eyebrow"><BriefcaseBusiness size={14} /> Access Support · Opportunity Matcher</span><h1>Turn the plan into<br /><em>real next steps.</em></h1><p>Discover opportunities that may help support your plan. These sourced opportunities may contribute to engine-generated targets; CampusOne does not decide eligibility or awards.</p></div><div className="target-summary"><span>Combined plan target</span><strong>{moneyExact(combinedTarget)}</strong><small>against a {moneyExact(targets.currentGap)} starting gap</small></div></header>
      <section className="target-grid" aria-label="Exact plan targets">
        <article><GraduationCap size={19} /><span>Tuition support target</span><strong>{moneyExact(targets.tuitionSupportAmount)}</strong><small>One-time modeled support</small></article>
        <article><DollarSign size={19} /><span>Income target</span><strong>{moneyExact(targets.monthlyIncomeAmount)} / month</strong><small>{moneyExact(targets.semesterIncomeAmount)} across this semester</small></article>
      </section>
      {matcher.isPending && <section className="opportunity-loading"><LoaderCircle className="spin" size={24} /><strong>Matching verified sources to your plan…</strong></section>}
      {matcher.isError && <section className="form-error" role="alert"><CircleAlert size={17} /> Sourced opportunities could not be loaded. Demo opportunities are still available below. <button onClick={() => window.location.reload()}>Try again</button></section>}
      {!matcher.isPending && <DemoOpportunityMatcher scenario={plan.selected.result} financialNeed={Math.max(0, targets.currentGap)} limit={8} onContinue={continueToUpdatedPlan} showContinue={!(result && result.opportunities.length > 0)} />}
      {result && result.opportunities.length > 0 && <><section className="opportunity-list">{result.opportunities.map((opportunity) => <article className="opportunity-card" key={opportunity.id}>
        <div className="opportunity-card-top"><span className={`opportunity-type opportunity-${opportunity.type}`}>{opportunity.type.replace('-', ' ')}</span><span className="verified-source"><ShieldCheck size={14} /> Source verified · {opportunity.verifiedAt}</span></div>
        <div className="opportunity-title"><div><h2>{opportunity.name}</h2><p>{opportunity.provider}</p></div><strong>{opportunity.amount}</strong></div>
        <div className="opportunity-deadline"><CalendarDays size={16} /><span><b>Deadline:</b> {opportunity.deadline}</span></div>
        <div className="opportunity-requirements"><span>Published requirements</span><ul>{opportunity.requirements.map((requirement) => <li key={requirement}>{requirement}</li>)}</ul></div>
        <div className="opportunity-impact"><Sparkles size={16} /><p><strong>Why this matched:</strong> {opportunity.relevanceExplanation}<br /><br /><strong>Possible plan effect:</strong> {opportunity.impactExplanation}</p></div>
        <p className="eligibility-notice">{opportunity.eligibilityNotice}</p>
        <a className="button button-outline" href={opportunity.sourceUrl} target="_blank" rel="noreferrer" data-testid={`link-opportunity-${opportunity.id}`}>Check official source <ExternalLink size={15} /></a>
      </article>)}</section><div className="opportunity-next-step"><div><span className="eyebrow">Next in your journey</span><h3>Continue to Updated Plan</h3><p>Continue with the active optimized plan; sourced opportunities do not change the Financial Twin until you explicitly simulate or apply a decision.</p></div><button className="button button-dark" onClick={() => continueToUpdatedPlan(null)} data-testid="button-continue-updated-plan">Continue to Updated Plan <ArrowRight size={16} /></button></div></>}{result && result.opportunities.length > 0 && <aside className="opportunity-disclaimer"><CircleAlert size={17} /><p><strong>Confirm before you count on it.</strong> {result.disclaimer}</p></aside>}
    </main>
  </PageShell>;
}

function FixMySemester() {
  const [, setLocation] = useLocation();
  const session = useGetAuthSession();
  const saveProfile = useSaveStudentProfile();
  const baseline = useMemo(() => loadSimulation(), []);
  const activeScenario = useMemo(() => baseline ? loadActiveScenario(baseline) : null, [baseline]);
  const sourceScenario = useMemo<ActiveScenario | null>(() => {
    if (activeScenario) return activeScenario;
    if (!baseline) return null;
    return { baselineProfile: baseline.profile, source: 'baseline', controls: controlsFromResult(baseline), result: baseline };
  }, [activeScenario, baseline]);
  const optimization = useOptimizeSemester();
  const [optimizationResult, setOptimizationResult] = useState<SemesterOptimizationResult | null>(null);
  const [analysisStep, setAnalysisStep] = useState(0);
  const started = useRef(false);

  const runOptimization = () => {
    if (!sourceScenario) return;
    setOptimizationResult(null);
    setAnalysisStep(0);
    optimization.mutate({ data: sourceScenario.result.profile }, {
      onSuccess: (result: SemesterOptimizationResult) => setOptimizationResult(result),
    });
  };

  useEffect(() => {
    if (!sourceScenario || started.current) return;
    started.current = true;
    runOptimization();
  }, [sourceScenario]);

  useEffect(() => {
    if (!optimization.isPending) return;
    const timer = window.setInterval(() => setAnalysisStep((step) => Math.min(analysisSteps.length - 1, step + 1)), 180);
    return () => window.clearInterval(timer);
  }, [optimization.isPending]);

  if (!baseline || !sourceScenario) return <EmptyDashboard onStart={() => setLocation('/dashboard')} />;

  const before = sourceScenario.result;
  const recommendation = optimizationResult?.recommendation;
  const applyPlan = () => {
    if (!optimizationResult || !recommendation) return;
    const finish = () => {
      saveAppliedPlan({ before: optimizationResult.baseline, selected: recommendation, interventions: optimizationResult.interventions });
      saveSimulation(recommendation.result);
      window.localStorage.removeItem(SCENARIO_STORAGE_KEY);
      window.localStorage.removeItem(OPPORTUNITY_STORAGE_KEY);
      window.localStorage.removeItem(OPPORTUNITY_PLAN_STORAGE_KEY);
      setLocation('/dashboard');
    };
    if (session.data?.authenticated) {
      saveProfile.mutate({ data: recommendation.profile }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/auth/session'] });
          finish();
        },
      });
    } else {
      finish();
    }
  };

  return (
    <PageShell className="optimize-page">
      <header className="dash-nav"><Logo /><nav><Link href="/dashboard" className="dash-nav-link">Financial Twin</Link><Link href="/futureme" className="dash-nav-link">FutureMe</Link><span className="dash-nav-active">Fix My Semester</span><Link href="/opportunities" className="dash-nav-link" aria-label="Opportunities">Access Support</Link><Link href="/institution" className="dash-nav-link" aria-label="Institution View">University Portal</Link></nav><div className="dash-user"><span className="user-avatar">{baseline.profile.name.slice(0, 1).toUpperCase()}</span><span>{baseline.profile.name}</span></div></header>
      <main className="optimize-main">
        <JourneyIndicator activeStep={2} />
        {optimization.isPending && <section className="analysis-sequence" aria-live="polite">
          <span className="optimize-icon"><LoaderCircle size={25} className="spin" /></span>
          <span className="eyebrow">Fix My Semester</span>
          <h1>Analyzing your<br /><em>semester.</em></h1>
          <p>Testing bounded changes against your exact {before.profile.creditHours}-credit scenario.</p>
          <div className="analysis-steps">{analysisSteps.map((step, index) => <div key={step} className={index <= analysisStep ? 'analysis-step-complete' : ''}>{index < analysisStep ? <CircleCheck size={16} /> : index === analysisStep ? <LoaderCircle size={16} className="spin" /> : <span />}{step}</div>)}</div>
        </section>}

        {optimization.isError && !optimization.isPending && <section className="analysis-sequence">
          <span className="optimize-icon optimize-icon-error"><CircleAlert size={25} /></span>
          <span className="eyebrow">Analysis paused</span>
          <h1>We could not compare<br /><em>the plans yet.</em></h1>
          <p>Your active scenario is still preserved. Try the analysis again without changing your Financial Twin.</p>
          <button className="button button-primary button-large" onClick={runOptimization} data-testid="button-retry-optimization"><RotateCcw size={16} /> Try Again</button>
        </section>}

        {optimizationResult && recommendation && <div className="optimization-result">
          <header className="optimization-heading">
            <div><span className="eyebrow">Fix My Semester · {optimizationResult.stabilized ? 'Semester Stabilized' : optimizationResult.gapReduced ? 'Gap Reduced' : 'Best available plan'}</span><h1>A more workable<br /><em>semester plan.</em></h1><p>Explore adjustments that could improve your semester plan. {optimizationResult.stabilized ? 'This calculated plan keeps the projected balance at or above zero through the semester.' : optimizationResult.gapReduced ? `This plan reduces the modeled pressure, with ${money(recommendation.gap)} still remaining at the lowest point.` : 'The bounded options did not improve this scenario enough. The assumptions remain visible so you can decide what is realistic.'}</p></div>
            <div className="scenario-origin"><span>Optimized from</span><strong>{sourceScenario.source === 'futureme' ? 'Active FutureMe scenario' : 'Current Financial Twin'}</strong><small>{before.profile.creditHours} credits · {optimizationResult.evaluatedCandidates} plans tested</small></div>
          </header>

          <section className="before-after" aria-label="Before and after semester comparison">
            <article className="outcome-panel outcome-before"><span className="eyebrow">Before</span><strong>{money(optimizationResult.baseline.finalProjectedBalance)}</strong><div><span>Health <b>{optimizationResult.baseline.financialHealthScore}/100</b></span><span>Risk <b>{optimizationResult.baseline.firstRiskMonth ? `Month ${optimizationResult.baseline.firstRiskMonth}` : 'None'}</b></span></div></article>
            <div className="outcome-shift"><ArrowRight size={24} /><span>{money(recommendation.result.finalProjectedBalance - optimizationResult.baseline.finalProjectedBalance)}</span></div>
            <article className={`outcome-panel outcome-after ${recommendation.stabilized ? 'outcome-stable' : ''}`}><span className="eyebrow">After</span><strong>{money(recommendation.result.finalProjectedBalance)}</strong><div><span>Health <b>{recommendation.result.financialHealthScore}/100</b></span><span>Risk <b>{recommendation.result.firstRiskMonth ? `Month ${recommendation.result.firstRiskMonth}` : 'None'}</b></span></div></article>
          </section>

          <section className="recommended-plan">
            <div className="section-heading-row"><div><span className="eyebrow">Recommended semester plan</span><h2>{optimizationResult.interventions.length ? 'Small changes, combined with intent.' : recommendation.stabilized ? 'Your current plan is already stable.' : 'No bounded change improved this plan.'}</h2></div><span className="comparison-note">Calculated by the Financial Twin engine</span></div>
            {optimizationResult.interventions.length > 0 ? <div className="intervention-list">{optimizationResult.interventions.map((intervention, index) => <article key={intervention.kind}><span className="intervention-number">0{index + 1}</span><div><h3>{intervention.label}</h3><p>{intervention.whyThisHelps}</p></div><div className="intervention-effect"><span>Calculated effect</span><strong>{intervention.gapReduction >= 0 ? '+' : ''}{money(intervention.gapReduction)}</strong><small>{intervention.scoreChange >= 0 ? '+' : ''}{intervention.scoreChange} health points</small></div></article>)}</div> : <div className={`stable-plan-note ${recommendation.stabilized ? '' : 'unresolved-plan-note'}`}>{recommendation.stabilized ? <CircleCheck size={20} /> : <CircleAlert size={20} />}<p>{recommendation.stabilized ? 'The optimizer kept every input unchanged because the current scenario already remains above zero.' : 'The bounded interventions could not improve this starting position without exceeding the policy limits. The unresolved pressure is shown honestly rather than presenting a false success.'}</p></div>}
          </section>

          {optimizationResult.alternatives.length > 0 && <section className="alternative-plans"><div className="section-heading-row"><div><span className="eyebrow">Other bounded paths</span><h2>What the engine also considered.</h2></div></div><div className="alternative-grid">{optimizationResult.alternatives.map((candidate, index) => <article key={index}><span>Option {index + 2}</span><strong>{money(candidate.result.finalProjectedBalance)}</strong><small>{candidate.stabilized ? 'Stable through semester' : `${money(candidate.gap)} remaining gap`} · Health {candidate.result.financialHealthScore}</small></article>)}</div></section>}

          <section className="apply-plan-panel">
            <div><span className="eyebrow">Close the loop</span><h2>Apply these assumptions to your Financial Twin?</h2><p>This updates the browser-local forecast with the selected calculated profile. It is decision support, not guaranteed financial advice.</p></div>
            <div className="apply-plan-actions"><button className="button button-outline button-large" onClick={() => { saveOpportunityPlan({ before: optimizationResult.baseline, selected: recommendation, interventions: optimizationResult.interventions, returnTo: '/fix-my-semester' }); setLocation('/opportunities'); }} data-testid="button-match-recommended-plan">Find Matching Support <BriefcaseBusiness size={17} /></button><button className="button button-primary button-large" onClick={applyPlan} disabled={saveProfile.isPending} data-testid="button-apply-plan">{saveProfile.isPending ? <LoaderCircle size={16} className="spin" /> : 'Apply This Plan'} <ArrowRight size={17} /></button></div>
          </section>
          <details className="optimization-policy"><summary>How CampusOne chose this plan</summary><p>{optimizationResult.policy}</p></details>
        </div>}
      </main>
    </PageShell>
  );
}
function EmptyDashboard({ onStart }: { onStart: () => void }) {
  return <PageShell className="empty-page"><header className="setup-nav"><Logo /><Link href="/" className="close-setup" data-testid="link-empty-home"><X size={19} /></Link></header><main className="empty-state"><div className="empty-art"><PiggyBank size={35} /><span /></div><span className="eyebrow">Your dashboard is waiting</span><h1>Let’s give your semester<br /><em>a little shape.</em></h1><p>Build a private forecast from your academic and money details. You will see the dashboard here when it is ready.</p><button className="button button-primary button-large" onClick={onStart} data-testid="button-empty-start">Build my financial twin <ArrowRight size={17} /></button></main></PageShell>;
}

const defaultCompanyOpportunity: CompanyOpportunityInput = {
  title: '',
  companyName: 'Northstar Digital Demo',
  opportunityType: 'Paid Internship',
  location: 'Amman',
  workMode: 'Hybrid',
  description: '',
  relevantMajors: 'Computer Science, Software Engineering',
  preferredSkills: 'Communication, problem solving',
  compensation: 150,
  duration: '3 months · 8–10 hours/week',
  deadline: '',
  applicationLink: '',
};

function CompanyPortal() {
  const [form, setForm] = useState<CompanyOpportunityInput>(defaultCompanyOpportunity);
  const [opportunities, setOpportunities] = useState(() => loadCompanyOpportunities());
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const update = (key: keyof CompanyOpportunityInput, value: string | number | null) => {
    setForm((current) => ({ ...current, [key]: value } as CompanyOpportunityInput));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!form.title.trim() || !form.companyName.trim() || !form.description.trim() || !form.deadline.trim()) {
      setError('Add an opportunity title, company name, description, and application deadline.');
      return;
    }
    setPending(true);
    try {
      const response = await fetch('/api/opportunities/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; opportunity?: { id?: string } };
      if (!response.ok) throw new Error(payload.error ?? 'The opportunity could not be published.');
      saveCompanyOpportunity(form, payload.opportunity?.id);
      setOpportunities(loadCompanyOpportunities());
      setForm(defaultCompanyOpportunity);
      setFormOpen(false);
      setSuccess('Opportunity published to the CampusOne demo ecosystem. Students can now see and simulate its potential impact.');
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The opportunity could not be published.');
    } finally {
      setPending(false);
    }
  };

  return (
    <PageShell className="company-page">
      <header className="dash-nav">
        <Logo />
        <nav>
          <span className="dash-nav-active">Company Portal</span>
        </nav>
        <div className="institution-label"><BriefcaseBusiness size={16} /> Company Demo</div>
      </header>
      <main className="company-main">
        <header className="company-heading">
          <div><span className="eyebrow">Company Portal · Demo Data</span><h1>Create pathways<br /><em>for students.</em></h1><p>Create opportunities and connect them with relevant student pathways through CampusOne. Published opportunities can appear in Access Support for student simulation.</p></div>
          <button className="button button-primary button-large" onClick={() => { setFormOpen((open) => !open); setError(''); setSuccess(''); }} data-testid="button-post-opportunity"><span>{formOpen ? 'Close form' : 'Post Opportunity'}</span><ArrowRight size={17} /></button>
        </header>
        <div className="demo-data-note"><CircleAlert size={15} /> Summary metrics and match activity are synthetic demo data. Company submissions are added to the shared opportunity catalog.</div>
        <section className="company-metric-grid" aria-label="Company summary metrics">
          {[
            ['Active Opportunities', String(opportunities.length), 'Published in the demo catalog'],
            ['Total Student Matches', String(9 + opportunities.length * 3), 'Synthetic match activity'],
            ['Student Interest', String(14 + opportunities.length * 2), 'Expressions of interest'],
            ['Applications / Interest', String(6 + opportunities.length), 'Demo conversion signal'],
          ].map(([label, value, note]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{note} · Demo Data</small></article>)}
        </section>
        {formOpen && <form className="company-form" onSubmit={submit}>
          <div className="company-form-heading"><div><span className="eyebrow">New opportunity</span><h2>Give students a clear next step.</h2></div><span>Required fields are marked in the form.</span></div>
          <div className="company-form-grid">
            <label className="company-field"><span>Opportunity title</span><input required value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="e.g. Paid Product Design Internship" data-testid="input-company-title" /></label>
            <label className="company-field"><span>Company name</span><input required value={form.companyName} onChange={(event) => update('companyName', event.target.value)} data-testid="input-company-name" /></label>
            <label className="company-field"><span>Opportunity type</span><select value={form.opportunityType} onChange={(event) => update('opportunityType', event.target.value as CompanyOpportunityInput['opportunityType'])} data-testid="select-company-type"><option>Internship</option><option>Paid Internship</option><option>Part-Time Job</option><option>Graduate Opportunity</option><option>Student Program</option></select></label>
            <label className="company-field"><span>Location</span><input required value={form.location} onChange={(event) => update('location', event.target.value)} placeholder="Amman" data-testid="input-company-location" /></label>
            <label className="company-field"><span>Work mode</span><select value={form.workMode} onChange={(event) => update('workMode', event.target.value as CompanyOpportunityInput['workMode'])} data-testid="select-company-mode"><option>On-site</option><option>Hybrid</option><option>Remote</option></select></label>
            <label className="company-field"><span>Monthly compensation / support <small>(optional)</small></span><input type="number" min="0" value={form.compensation ?? ''} onChange={(event) => update('compensation', event.target.value ? Number(event.target.value) : null)} placeholder="150" data-testid="input-company-compensation" /></label>
            <label className="company-field company-field-wide"><span>Description</span><textarea required value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="What will the student work on, and what support will they receive?" rows={4} data-testid="input-company-description" /></label>
            <label className="company-field"><span>Relevant majors</span><input value={form.relevantMajors} onChange={(event) => update('relevantMajors', event.target.value)} placeholder="Computer Science, Business" data-testid="input-company-majors" /></label>
            <label className="company-field"><span>Preferred skills</span><input value={form.preferredSkills} onChange={(event) => update('preferredSkills', event.target.value)} placeholder="Communication, Excel" data-testid="input-company-skills" /></label>
            <label className="company-field"><span>Duration</span><input required value={form.duration} onChange={(event) => update('duration', event.target.value)} placeholder="3 months · 10 hours/week" data-testid="input-company-duration" /></label>
            <label className="company-field"><span>Application deadline</span><input required value={form.deadline} onChange={(event) => update('deadline', event.target.value)} placeholder="30 April 2026" data-testid="input-company-deadline" /></label>
            <label className="company-field company-field-wide"><span>Application link <small>(optional)</small></span><input type="url" value={form.applicationLink} onChange={(event) => update('applicationLink', event.target.value)} placeholder="https://company.example/apply" data-testid="input-company-link" /></label>
          </div>
          {error && <div className="form-error" role="alert" data-testid="status-company-error"><CircleAlert size={16} /> {error}</div>}
          <div className="company-form-actions"><span>Published opportunities enter the existing CampusOne Opportunity Matcher.</span><button type="submit" className="button button-primary" disabled={pending} data-testid="button-submit-opportunity">{pending ? <><LoaderCircle size={16} className="spin" /> Publishing</> : <>Publish Opportunity <ArrowRight size={16} /></>}</button></div>
        </form>}
        {success && <div className="company-success" role="status" data-testid="status-company-success"><CircleCheck size={17} /> {success}</div>}
        <section className="company-opportunities">
          <div className="section-heading-row"><div><span className="eyebrow">Your Opportunities</span><h2>Published pathways.</h2></div><span className="comparison-note">{opportunities.length} active · Demo Data</span></div>
          <div className="company-opportunity-list">{opportunities.length ? opportunities.map((opportunity) => <article key={opportunity.id} data-testid={`company-opportunity-${opportunity.id}`}><div className="company-opportunity-top"><span className="opportunity-type">{opportunity.type}</span><span className="company-status">Active</span></div><h3>{opportunity.title}</h3><p>{opportunity.provider} · {opportunity.workMode} · {opportunity.hours}</p><div className="company-opportunity-meta"><span><small>Potential matches</small><strong>Demo signal</strong></span><span><small>Interest</small><strong>Demo signal</strong></span><span><small>Deadline</small><strong>{opportunity.availability === 'Open' ? 'Open' : 'Opening soon'}</strong></span></div></article>) : <div className="company-empty"><BriefcaseBusiness size={20} /><p>No opportunities published yet. Start with one paid internship to connect a student pathway to the Financial Twin.</p></div>}</div>
        </section>
      </main>
    </PageShell>
  );
}

function UniversityDashboard() {
  const [, setLocation] = useLocation();
  const companyOpportunities = loadCompanyOpportunities();
  const allOpportunities = [...demoOpportunities, ...companyOpportunities];
  const potentialSupport = allOpportunities.reduce((total, opportunity) => total + opportunity.value, 0);
  const metrics = [
    { label: 'Students monitored', value: '24', note: 'Synthetic demo cohort' },
    { label: 'Financially stable', value: '62%', note: 'Forecast remains above zero' },
    { label: 'Projected financial pressure', value: '38%', note: 'At least one modeled risk month' },
    { label: 'Students requiring attention', value: '5', note: 'Aggregated directional indicator' },
  ];
  const pressureTimeline = [18, 29, 47, 68, 41];
  const pressureDrivers = [
    ['Tuition', 'Primary', 82],
    ['Food / living expenses', 'High', 61],
    ['Low income', 'Moderate', 48],
    ['Transportation', 'Moderate', 35],
    ['Academic load', 'Emerging', 24],
  ] as const;
  const supportDemand = [
    ['Scholarships', 'High'],
    ['Financial aid', 'High'],
    ['Paid internships', 'Medium'],
    ['Part-time jobs', 'Medium'],
    ['Student programs', 'Emerging'],
  ] as const;
  return (
    <PageShell className="institution-page">
      <header className="dash-nav"><Logo /><nav><span className="dash-nav-active">University Portal</span></nav><div className="institution-label"><Building2 size={16} /> Demo Institutional Data</div></header>
      <main className="institution-main">
        <div className="institution-heading"><div><span className="eyebrow">Campus Financial Wellness</span><h1>Understand pressure.<br /><em>Support earlier.</em></h1><p>Understand aggregated student financial wellness and support needs.</p></div><div className="institution-heading-meta"><span className="demo-data-badge">Demo Institutional Data · Synthetic Demo Data</span><span className="privacy-chip"><ShieldCheck size={15} /> No individual student details</span></div></div>
        <section className="institution-grid" aria-label="Aggregated institutional summary">{metrics.map((metric) => <article key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small></article>)}</section>
        <section className="institution-panel pressure-timeline"><div className="institution-section-heading"><div><span className="eyebrow">Semester financial risk timeline</span><h2>When is financial pressure expected to peak?</h2><p>Aggregated projected pressure across the five-month synthetic demo semester.</p></div><span className="institution-insight">Peak signal · Month 4</span></div><div className="pressure-bars" aria-label="Aggregated projected pressure by semester month">{pressureTimeline.map((value, index) => <div key={index}><span style={{ height: `${value}%` }} /><small>Month {index + 1}</small></div>)}</div><p className="institution-footnote">In this demo cohort, pressure increases around major tuition-payment periods. This is a directional institutional signal, not a prediction about any individual student.</p></section>
        <section className="institution-two-column"><article className="institution-panel"><div className="institution-section-heading"><div><span className="eyebrow">Main pressure drivers</span><h2>What’s driving financial pressure?</h2></div></div><div className="driver-list">{pressureDrivers.map(([label, signal, width]) => <div key={label}><div><span>{label}</span><strong>{signal}</strong></div><div className="driver-track"><span style={{ width: `${width}%` }} /></div></div>)}</div><p className="institution-footnote">Signals are grouped from the existing Financial Twin inputs. No new risk-scoring model is applied.</p></article><article className="institution-panel"><div className="institution-section-heading"><div><span className="eyebrow">Financial wellness distribution</span><h2>How the demo cohort is trending.</h2></div></div><div className="wellness-distribution"><div><span className="wellness-dot stable" /><strong>Stable</strong><b>62%</b><small>Forecast remains above zero</small></div><div><span className="wellness-dot watch" /><strong>Watch</strong><b>23%</b><small>Pressure appears later in semester</small></div><div><span className="wellness-dot risk" /><strong>At Risk</strong><b>15%</b><small>Earlier modeled pressure</small></div></div><p className="institution-footnote">Aggregated demo indicators only. The dashboard never ranks or identifies students.</p></article></section>
        <section className="institution-two-column institution-lower-grid"><article className="institution-panel"><div className="institution-section-heading"><div><span className="eyebrow">Student support demand</span><h2>Where support may help.</h2></div><span className="comparison-note">Directional demo signal</span></div><div className="support-demand-list">{supportDemand.map(([label, signal]) => <div key={label}><span>{label}</span><strong>{signal}</strong></div>)}</div></article><article className="institution-panel institution-ecosystem-card"><div className="institution-section-heading"><div><span className="eyebrow">Opportunity ecosystem</span><h2>University → companies → students.</h2></div></div><div className="ecosystem-metrics"><div><span>Active opportunities</span><strong>{allOpportunities.length}</strong><small>Demo catalog</small></div><div><span>Company partners</span><strong>{new Set(allOpportunities.map((opportunity) => opportunity.provider)).size}</strong><small>Demo providers</small></div><div><span>Student matches</span><strong>{18 + companyOpportunities.length * 3}</strong><small>Synthetic activity</small></div><div><span>Potential support</span><strong>{money(potentialSupport)}</strong><small>Monthly opportunity value</small></div></div><Link className="button button-outline" href="/company">Open Company Portal <ArrowRight size={15} /></Link></article></section>
        <p className="institution-privacy-note"><ShieldCheck size={15} /> Campus Financial Wellness is aggregated, privacy-conscious decision support. It does not show student names, balances, salaries, applications, or individual financial gaps.</p>
      </main>
    </PageShell>
  );
}

function OpportunitiesPage() {
  const [, setLocation] = useLocation();
  const simulation = useMemo(() => loadSimulation(), []);
  if (!simulation) return <EmptyDashboard onStart={() => setLocation('/setup')} />;
  const need = Math.max(0, -simulation.lowestProjectedBalance);
  const continueToUpdatedPlan = (opportunity: OpportunitySimulation | null) => {
    const appliedPlan = loadAppliedPlan(simulation);
    const after = opportunity?.after ?? simulation;
    saveUpdatedPlan({ before: appliedPlan?.before ?? simulation, after, optimizedPlan: appliedPlan, opportunity });
    saveSimulation(after);
    window.localStorage.removeItem(OPPORTUNITY_STORAGE_KEY);
    setLocation('/dashboard');
  };
  return <PageShell className="opportunities-page"><header className="dash-nav"><Logo /><nav><Link href="/dashboard" className="dash-nav-link">Financial Twin</Link><Link href="/futureme" className="dash-nav-link">FutureMe</Link><span className="dash-nav-active">Access Support</span><Link href="/institution" className="dash-nav-link" aria-label="Institution View">University Portal</Link></nav><div className="dash-user"><span className="user-avatar">{simulation.profile.name.slice(0, 1).toUpperCase()}</span><span>{simulation.profile.name}</span></div></header><main className="opportunities-main"><JourneyIndicator activeStep={3} /><div className="opportunities-heading"><span className="eyebrow">Access Support · Demo Opportunities</span><h1>Discover relevant<br /><em>support.</em></h1><p>Discover opportunities that may help support your plan. {need > 0 ? `Transparent demo matches are based on ${simulation.profile.major} and the Financial Twin’s ${money(need)} modeled need.` : 'You’re currently on track financially, but opportunities may still strengthen your semester.'}</p></div><DemoOpportunityMatcher scenario={simulation} financialNeed={need} limit={8} onContinue={continueToUpdatedPlan} /></main></PageShell>;
}

function buildFallbackAnswer(simulation: SemesterSimulationResult | null, activeScenario: SemesterSimulationResult | null, appliedPlan: AppliedPlan | null, opportunitySimulation: OpportunitySimulation | null) {
  const current = activeScenario ?? simulation;
  if (!current) return 'Build your Financial Twin first. Then I can explain your current balance, risk month, and next step using the saved forecast.';
  const living = current.profile.food + current.profile.transportation + current.profile.otherExpenses;
  const risk = current.firstRiskMonth ? `The current ${activeScenario ? 'FutureMe scenario' : 'forecast'} first falls below zero in Month ${current.firstRiskMonth}.` : `The current ${activeScenario ? 'FutureMe scenario' : 'forecast'} stays at or above zero through the semester.`;
  const action = current.firstRiskMonth ? 'Use Fix My Semester to test bounded changes. Demo Opportunities can show support options, but a match is not official eligibility.' : 'Use FutureMe before changing credits, income, or expenses so the Financial Twin can compare the effect.';
  const plan = appliedPlan ? ` Your applied optimized plan improved the projected ending balance by ${money(appliedPlan.selected.result.finalProjectedBalance - appliedPlan.before.finalProjectedBalance)}.` : '';
  const opportunity = opportunitySimulation ? ` The ${opportunitySimulation.opportunity.title} demo comparison moved the engine result from ${money(opportunitySimulation.before.finalProjectedBalance)} to ${money(opportunitySimulation.after.finalProjectedBalance)}; this is not an award or eligibility decision.` : '';
  return `${risk} Your current plan includes ${money(current.tuition)} tuition, ${money(current.profile.monthlyIncome)} monthly income, and ${money(living)} monthly living expenses, producing a ${money(current.finalProjectedBalance)} projected ending balance.${plan}${opportunity} ${action}`;
}

function AskCampusOne() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('Why am I at risk and what can I do?');
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState(false);
  const quickQuestions = ['Why am I at risk and what can I do?', 'What happens if I register 18 credits?', 'Which opportunity fits my situation?', 'Explain my optimized plan.'];

  const ask = async (nextQuestion = question) => {
    const simulation = loadSimulation();
    const activeScenario = simulation ? loadActiveScenario(simulation) : null;
    const appliedPlan = simulation ? loadAppliedPlan(simulation) : null;
    const currentScenario = activeScenario?.result ?? simulation;
    const opportunitySimulation = loadOpportunitySimulation(currentScenario);
    const context = simulation ? {
      student: { name: simulation.profile.name, major: simulation.profile.major },
      current: {
        creditHours: simulation.profile.creditHours,
        tuition: simulation.tuition,
        monthlyIncome: simulation.profile.monthlyIncome,
        startingBalance: simulation.profile.currentBalance,
        monthlyLivingExpenses: simulation.profile.food + simulation.profile.transportation + simulation.profile.otherExpenses,
        projectedBalance: simulation.finalProjectedBalance,
        riskMonth: simulation.firstRiskMonth,
        financialHealth: simulation.financialHealthScore,
      },
      activeFutureMe: activeScenario?.result ?? null,
      optimizedPlan: appliedPlan ? { before: appliedPlan.before, after: appliedPlan.selected.result, interventions: appliedPlan.interventions } : null,
      matchedOpportunity: opportunitySimulation ? { title: opportunitySimulation.opportunity.title, matchScore: opportunitySimulation.opportunity.matchScore, value: opportunitySimulation.opportunity.value, simulatedOutcome: opportunitySimulation.after } : null,
    } : null;
    setQuestion(nextQuestion);
    setPending(true);
    setAnswer('');
    try {
      const response = await fetch('/api/copilot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: nextQuestion, context }) });
      if (!response.ok) throw new Error('Copilot unavailable');
      const data = await response.json() as { answer: string | null };
      if (!data.answer) throw new Error('Copilot fallback requested');
      setAnswer(data.answer);
    } catch {
      setAnswer(buildFallbackAnswer(simulation, activeScenario?.result ?? null, appliedPlan, opportunitySimulation));
    } finally {
      setPending(false);
    }
  };

  return <div className={`copilot ${open ? 'copilot-open' : ''}`}><button className="copilot-trigger" onClick={() => setOpen((value) => !value)} aria-label="Ask CampusOne" aria-expanded={open} data-testid="button-ask-campusone"><img src="/brand/campusone-app-icon.png" alt="" /><span className="copilot-tooltip">Ask CampusOne</span></button>{open && <section className="copilot-panel" aria-label="Ask CampusOne assistant"><header><div><span className="eyebrow">Current-state assistant</span><h2>Ask CampusOne</h2></div><button onClick={() => setOpen(false)} aria-label="Close Ask CampusOne"><X size={18} /></button></header><div className="copilot-questions">{quickQuestions.map((item) => <button key={item} onClick={() => ask(item)}>{item}</button>)}</div><form onSubmit={(event) => { event.preventDefault(); ask(); }}><label htmlFor="copilot-question">Ask about your current plan</label><div><input id="copilot-question" value={question} onChange={(event) => setQuestion(event.target.value)} /><button type="submit" disabled={pending || !question.trim()} aria-label="Send question">{pending ? <LoaderCircle size={16} className="spin" /> : <ArrowRight size={16} />}</button></div></form>{(pending || answer) && <div className="copilot-answer" aria-live="polite">{pending ? 'Reading your current Financial Twin…' : answer}</div>}<small>The Financial Twin calculates. Ask CampusOne explains. Opportunity matches are not official eligibility.</small></section>}</div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/sign-in">{() => <AuthPage mode="sign-in" />}</Route><Route path="/sign-up">{() => <AuthPage mode="sign-up" />}</Route><Route path="/setup" component={Setup} /><Route path="/dashboard" component={Dashboard} /><Route path="/futureme" component={FutureMe} /><Route path="/fix-my-semester" component={FixMySemester} /><Route path="/opportunities" component={OpportunityMatcher} /><Route path="/institution" component={UniversityDashboard} /><Route path="/company" component={CompanyPortal} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /><AskCampusOne /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;

function loadOpportunityPlan(): OpportunityPlan | null {
  try {
    const saved = window.localStorage.getItem(OPPORTUNITY_PLAN_STORAGE_KEY);
    return saved ? JSON.parse(saved) as OpportunityPlan : null;
  } catch {
    return null;
  }
}

type Opportunity = {
  id: string; name: string; provider: string; sourceUrl: string; type: 'scholarship' | 'aid' | 'paid-opportunity';
  amount: string; estimatedAmount: number | null; deadline: string; requirements: string[];
  verificationStatus: 'verified-source'; verifiedAt: string; impactExplanation: string; relevanceExplanation: string; eligibilityNotice: string;
};

type OpportunityMatchResult = { targets: OpportunityTargets; opportunities: Opportunity[]; disclaimer: string };
