import { createBackup } from './backup';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  Archive, ArrowDownToLine, ArrowRight, BadgeCheck, BookOpenCheck, CarFront,
  Check, ChevronRight, CircleHelp, ClipboardCheck, Database, FileJson2,
  ExternalLink, FileText, Gauge, History, Import, Layers3, Menu, MessageSquareText,
  PackageSearch, Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles,
  Upload, X, Wrench, type LucideIcon,
} from 'lucide-react';
import { CATALOG_PROVIDERS } from './catalog-connectors';

type State = 'received' | 'verified';
type Vehicle = { id: string; registration: string; vin: string; make: string; model: string; engine: string; version: string; source: string; status: State; receivedAt: string };
type Part = { id: string; designation: string; oe: string; brand: string; reference: string; source: string; status: State; receivedAt: string };
type Compatibility = { id: string; vehicleId: string; partId: string; source: string; status: State; authorized: boolean; decisionBy: string; decisionAt: string };

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string' || !result.includes(',')) {
        reject(new Error('Conversion Base64 impossible'));
        return;
      }
      resolve(result.split(',')[1]);
    };
    reader.onerror = () =>
      reject(reader.error || new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });
}

type CatalogDoc = { id: string; filename: string; type: string; origin: string; importedAt: string; size: number; fileBlob?: Blob; fileBase64?: string };
type SearchRecord = { id: string; query: string; kind: string; count: number; at: string };
type Tables = { vehicles: Vehicle[]; parts: Part[]; compatibilities: Compatibility[]; documents: CatalogDoc[]; history: SearchRecord[] };
type View = 'dashboard' | 'vehicles' | 'parts' | 'compat' | 'import' | 'assistant' | 'history';
type RelationState = 'verified' | 'pending' | 'stop';

const DB_NAME = 'piece-sure-local';
const DB_VERSION = 1;
const TABLES: (keyof Tables)[] = ['vehicles', 'parts', 'compatibilities', 'documents', 'history'];
const freshData: Tables = { vehicles: [], parts: [], compatibilities: [], documents: [], history: [] };
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible dans ce navigateur.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const table of TABLES) if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossible d’ouvrir la base locale.'));
  });
}
async function readAll<T>(table: keyof Tables): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(table, 'readonly').objectStore(table).getAll();
    request.onsuccess = () => { resolve(request.result as T[]); db.close(); };
    request.onerror = () => { reject(request.error); db.close(); };
  });
}
async function put<T extends { id: string }>(table: keyof Tables, record: T) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    tx.objectStore(table).put(record);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
async function remove(table: keyof Tables, id: string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(table, 'readwrite');
    tx.objectStore(table).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const navItems: { id: View; label: string; icon: LucideIcon; group: string }[] = [
  { id: 'dashboard', label: 'Vue d’ensemble', icon: Gauge, group: 'Espace de travail' },
  { id: 'vehicles', label: 'Véhicules', icon: CarFront, group: 'Espace de travail' },
  { id: 'parts', label: 'Références pièces', icon: Wrench, group: 'Espace de travail' },
  { id: 'compat', label: 'Compatibilités', icon: ClipboardCheck, group: 'Espace de travail' },
  { id: 'import', label: 'Importer un catalogue', icon: Import, group: 'Données locales' },
  { id: 'assistant', label: 'Assistant local', icon: MessageSquareText, group: 'Données locales' },
  { id: 'history', label: 'Historique', icon: History, group: 'Données locales' },
];
const titles: Record<View, [string, string]> = {
  dashboard: ['Vue d’ensemble', 'Votre poste de vente, alimenté uniquement par vos propres preuves catalogue.'],
  vehicles: ['Recherche véhicule', 'Retrouvez un dossier local par immatriculation ou numéro VIN.'],
  parts: ['Références pièces', 'Recherchez parmi les désignations et références importées.'],
  compat: ['Compatibilités', 'Une relation explicite vérifiée est nécessaire avant toute confirmation.'],
  import: ['Importer un catalogue', 'Ajoutez des données structurées et conservez vos documents comme preuves.'],
  assistant: ['Assistant local', 'Une recherche déterministe dans vos données, avec sources citées.'],
  history: ['Historique des recherches', 'Les recherches restent dans ce navigateur.'],
};
const fmtDate = (s: string) => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s));
const clean = (s: unknown) => String(s ?? '').trim();
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function relationState(relation: Compatibility, data: Tables): RelationState {
  const vehicle = data.vehicles.find((v) => v.id === relation.vehicleId);
  const part = data.parts.find((p) => p.id === relation.partId);
  if (!relation.source.trim() || !vehicle || !part) return 'stop';
  if (relation.status === 'verified' && vehicle.status === 'verified' && part.status === 'verified') return 'verified';
  return 'pending';
}
function partMatches(part: Part, term: string, referenceType: string) {
  const fields = referenceType === 'OE'
    ? part.oe
    : referenceType === 'Fabricant'
      ? `${part.brand} ${part.reference}`
      : `${part.designation} ${part.oe} ${part.brand} ${part.reference}`;
  if (referenceType === 'OE' && !part.oe) return false;
  if (referenceType === 'Fabricant' && !part.brand && !part.reference) return false;
  return !norm(term) || norm(fields).includes(norm(term));
}

function Status({ state, kind = 'pending', label }: { state?: State; kind?: 'pending' | 'verified' | 'stop' | 'neutral'; label?: string }) {
  if (kind === 'stop') return <span className="status stop">🔴 STOP</span>;
  if (kind === 'neutral') return <span className="status neutral">{label || 'Non autorisée'}</span>;
  if (kind === 'verified') return <span className="status verified">🟢 Vérifié</span>;
  return <span className={`status ${state === 'verified' ? 'verified' : 'pending'}`}>{state === 'verified' ? '🟢 Vérifié' : '🟠 À vérifier'}</span>;
}

function App() {
  const [view, setView] = useState<View>('dashboard');
  const [db, setDb] = useState<Tables>(freshData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('');
  const [modal, setModal] = useState<'vehicle' | 'part' | 'compat' | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await Promise.all(TABLES.map((t) => readAll(t)));
      const next = Object.fromEntries(TABLES.map((t, i) => [t, entries[i]])) as unknown as Tables;
      setDb(next); setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Erreur de lecture locale.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const notify = (message: string) => setToast(message);

  const downloadBackup = async () => {
    try {
      const backup = await createBackup();
      const url = URL.createObjectURL(backup);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PIECE-SURE-AI-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      notify('Téléchargement demandé. Vérifiez le fichier dans Téléchargements.');
    } catch (error) {
      notify('Sauvegarde impossible : ' + (error instanceof Error ? error.message : 'erreur inconnue'));
    }
  };

  const navigate = (next: View) => { setView(next); setFilter(''); setMobileOpen(false); };

  async function addVehicle(form: Vehicle) { await put('vehicles', form); await refresh(); setModal(null); notify('Véhicule ajouté à vos données locales.'); }
  async function addPart(form: Part) { await put('parts', form); await refresh(); setModal(null); notify('Référence ajoutée à vos données locales.'); }
  async function addCompat(form: Compatibility) { await put('compatibilities', form); await refresh(); setModal(null); notify('Relation enregistrée — à vérifier avant décision.'); }
  async function verify(table: 'vehicles' | 'parts' | 'compatibilities', id: string) {
    const record = db[table].find((r) => r.id === id);
    if (!record) return;
    if (table === 'compatibilities') {
      const relation = record as Compatibility;
      const vehicle = db.vehicles.find((v) => v.id === relation.vehicleId);
      const part = db.parts.find((p) => p.id === relation.partId);
      if (!relation.source.trim() || !vehicle || !part) {
        notify('Vérification impossible : véhicule, pièce et source explicite sont requis.');
        return;
      }
      if (vehicle.status !== 'verified' || part.status !== 'verified') {
        notify('Vérifiez d’abord la fiche véhicule et la référence pièce liées.');
        return;
      }
    }
    await put(table, { ...record, status: 'verified' } as never);
    await refresh(); notify('Évidence marquée comme vérifiée.');
  }
  async function decide(id: string, authorized: boolean) {
    const relation = db.compatibilities.find((c) => c.id === id);
    if (!relation) return;
    const name = window.prompt(authorized ? 'Nom ou identifiant de la personne autorisée à confirmer :' : 'Nom ou identifiant de la personne qui consigne le refus :');
    if (!name?.trim()) return;
    await put('compatibilities', { ...relation, authorized, decisionBy: name.trim(), decisionAt: now() });
    await refresh(); notify(authorized ? 'Décision autorisée consignée séparément.' : 'Refus consigné.');
  }
  async function deleteRecord(table: 'vehicles' | 'parts' | 'compatibilities', id: string) {
    if (!window.confirm('Supprimer cet enregistrement local ?')) return;
    await remove(table, id); await refresh(); notify('Enregistrement supprimé.');
  }
  async function logSearch(query: string, kind: string, count: number) {
    if (!query.trim()) return;
    await put('history', { id: uid(), query, kind, count, at: now() });
    await refresh();
  }

  const current = titles[view];
  const pageProps = { db, filter, setFilter, notify, navigate, verify, deleteRecord, setModal, logSearch, loading };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">P/S</div><div><div className="brand-name">PIÈCE-SÛRE</div><div className="brand-sub">AI · Poste de vente</div></div></div>
        {['Espace de travail', 'Données locales'].map((group) => <div key={group}>
          <div className="nav-label">{group}</div>
          <nav className="nav-list" aria-label={group}>
            {navItems.filter((i) => i.group === group).map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)} aria-current={view === id ? 'page' : undefined}><Icon />{label}</button>)}
          </nav>
        </div>)}
        <div className="sidebar-bottom"><div className="local-note"><strong><span className="local-dot" />Base locale active</strong>Vos données restent dans ce navigateur. Aucun service distant n’est appelé.</div></div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-menu"><button className="icon-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Ouvrir le menu"><Menu /></button><span className="mobile-brand">PIÈCE-SÛRE AI</span></div>
          <div className="breadcrumb">Poste de vente <ChevronRight size={12} /> {current[0]}</div>
          <div className="topbar-right"><button type="button" onClick={downloadBackup}>Sauvegarder mes données</button><span className="local-pill"><span className="local-dot" />Données stockées sur cet appareil</span></div>
        </header>
        {mobileOpen && <div className="mobile-menu-pop">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => navigate(id)}><Icon />{label}</button>)}</div>}
        <main className="page-wrap fade-in" key={view}>
          {loadError ? <div className="panel"><div className="empty-state"><div className="empty-icon"><CircleHelp /></div><strong>La base locale est indisponible</strong><p>{loadError}</p><button className="button primary" onClick={() => void refresh()}>Réessayer</button></div></div> :
            loading ? <Loading /> : <>
              <div className="page-heading"><div><div className="eyebrow">PIÈCE-SÛRE AI / LOCAL</div><h1 className="page-title">{current[0]}</h1><p className="page-subtitle">{current[1]}</p></div>
                {view === 'vehicles' && <button className="button primary" onClick={() => setModal('vehicle')}><Plus />Ajouter véhicule</button>}
                {view === 'parts' && <button className="button primary" onClick={() => setModal('part')}><Plus />Ajouter référence</button>}
                {view === 'compat' && <button className="button primary" onClick={() => setModal('compat')}><Plus />Créer relation</button>}
                {view === 'import' && <button className="button primary" onClick={() => document.getElementById('catalog-upload')?.click()}><Upload />Importer fichiers</button>}
              </div>
              {view === 'dashboard' && <Dashboard {...pageProps} />}
              {view === 'vehicles' && <Vehicles {...pageProps} />}
              {view === 'parts' && <Parts {...pageProps} />}
              {view === 'compat' && <Compatibilities {...pageProps} decide={decide} />}
              {view === 'import' && <ImportPage db={db} refresh={refresh} notify={notify} />}
              {view === 'assistant' && <Assistant {...pageProps} />}
              {view === 'history' && <HistoryPage {...pageProps} refresh={refresh} />}
            </>}
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navigation principale">
        {navItems.filter((item) => ['dashboard', 'vehicles', 'parts', 'compat', 'assistant'].includes(item.id)).map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => navigate(id)}><Icon /><span>{id === 'dashboard' ? 'Accueil' : id === 'vehicles' ? 'Véhicules' : id === 'parts' ? 'Pièces' : id === 'compat' ? 'Contrôle' : 'Assistant'}</span></button>)}
      </nav>
      {modal && <RecordModal kind={modal} db={db} onClose={() => setModal(null)} onVehicle={addVehicle} onPart={addPart} onCompat={addCompat} />}
      {toast && <div className="toast-note" role="status">{toast}</div>}
    </div>
  );
}

function Loading() {
  return <div className="loading-stack" aria-label="Chargement des données locales"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>;
}

type PageProps = { db: Tables; filter: string; setFilter: (s: string) => void; notify: (s: string) => void; navigate: (v: View) => void; verify: (t: 'vehicles' | 'parts' | 'compatibilities', id: string) => Promise<void>; deleteRecord: (t: 'vehicles' | 'parts' | 'compatibilities', id: string) => Promise<void>; setModal: (m: 'vehicle' | 'part' | 'compat' | null) => void; logSearch: (q: string, kind: string, count: number) => Promise<void>; loading: boolean };

function Dashboard({ db, navigate }: PageProps) {
  const pending = db.vehicles.filter((v) => v.status !== 'verified').length + db.parts.filter((p) => p.status !== 'verified').length + db.compatibilities.filter((c) => c.status !== 'verified').length;
  const relationVerified = db.compatibilities.filter((c) => c.status === 'verified').length;
  return <>
    <div className="metrics">
      <Metric label="VÉHICULES LOCAUX" value={db.vehicles.length} foot="Enregistrés dans cet appareil" />
      <Metric label="RÉFÉRENCES PIÈCES" value={db.parts.length} foot="Issues de vos catalogues" />
      <Metric label="RELATIONS VÉRIFIÉES" value={relationVerified} foot="Compatibilités explicites" />
      <Metric label="À CONTRÔLER" value={pending} foot="Éléments reçus, non vérifiés" />
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <div className="panel-head"><div><div className="panel-title">Accès direct</div><div className="panel-caption">Les outils essentiels du comptoir</div></div><SlidersHorizontal size={15} color="#80919e" /></div>
        <div className="panel-body"><div className="quick-grid">
          <Quick icon={CarFront} title="Identifier un véhicule" desc="Immatriculation ou numéro VIN" onClick={() => navigate('vehicles')} />
          <Quick icon={PackageSearch} title="Trouver une référence" desc="Désignation, OE ou fabricant" onClick={() => navigate('parts')} />
          <Quick icon={ClipboardCheck} title="Contrôler une compatibilité" desc="Relation explicite et preuve requises" onClick={() => navigate('compat')} />
          <Quick icon={Import} title="Importer des données" desc="CSV, JSON et documents catalogue" onClick={() => navigate('import')} />
        </div></div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><div className="panel-title">État des données</div><div className="panel-caption">Aucune donnée n’est fournie à l’installation</div></div><Database size={15} color="#80919e" /></div>
        {db.vehicles.length + db.parts.length + db.compatibilities.length === 0 ? <div className="empty-state"><div className="empty-icon"><Layers3 /></div><strong>Votre base est prête</strong><p>Importez votre catalogue pour rechercher des faits sourcés. Aucun résultat fictif n’est affiché.</p><button className="button green small" onClick={() => navigate('import')}>Commencer un import <ArrowRight size={13} /></button></div> :
          <div className="panel-body"><div className="callout">Les nouvelles données sont enregistrées « À vérifier ». Seule une compatibilité importée explicitement puis vérifiée peut être affichée en vert.</div><div style={{ marginTop: 13 }}><span className="status verified">🟢 Vérifié</span> <span className="status pending">🟠 À vérifier</span> <span className="status stop">🔴 STOP</span></div></div>}
      </section>
    </div>
    <div className="dashboard-grid" style={{ marginTop: 15 }}>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Activité récente</div><div className="panel-caption">Historique conservé localement</div></div><button className="button small" onClick={() => navigate('history')}>Tout voir</button></div>
        {db.history.length ? <div className="table-wrap"><table><thead><tr><th>Recherche</th><th>Type</th><th>Résultats</th><th>Date</th></tr></thead><tbody>{[...db.history].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,4).map((h)=><tr key={h.id}><td>{h.query}</td><td>{h.kind}</td><td>{h.count}</td><td>{fmtDate(h.at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><strong>Aucune recherche enregistrée</strong><p>Vos recherches apparaîtront ici.</p></div>}</section>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Accès catalogue</div><div className="panel-caption">Connecteurs soumis à une autorisation</div></div><ShieldCheck size={15} color="#80919e" /></div><ConnectorList /></section>
    </div>
  </>;
}
function Metric({ label, value, foot }: { label: string; value: number; foot: string }) { return <div className="panel metric"><div className="metric-label">{label}</div><div className="metric-value">{value.toLocaleString('fr-FR')}</div><div className="metric-foot">{foot}</div></div>; }
function Quick({ icon: Icon, title, desc, onClick }: { icon: LucideIcon; title: string; desc: string; onClick: () => void }) { return <button className="quick-action" onClick={onClick}><div className="quick-icon"><Icon /></div><div><strong>{title}</strong><span>{desc}</span></div></button>; }

function Vehicles(props: PageProps) {
  const { db, filter, setFilter, logSearch, verify, deleteRecord } = props;
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const matched = useMemo(() => db.vehicles.filter((v) => !filter || norm([v.registration,v.vin,v.make,v.model,v.engine,v.version].join(' ')).includes(norm(filter))), [db.vehicles,filter]);
  const search = (e: FormEvent) => { e.preventDefault(); setFilter(query.trim()); setSearched(true); void logSearch(query.trim(), 'Véhicule', db.vehicles.filter((v)=>norm([v.registration,v.vin].join(' ')).includes(norm(query))).length); };
  return <div className="panel">
    <div className="panel-head"><div><div className="panel-title">Recherche par véhicule</div><div className="panel-caption">Recherche exacte ou partielle dans les dossiers importés</div></div><span className="status neutral">{db.vehicles.length} dossier{db.vehicles.length > 1 ? 's' : ''}</span></div>
    <div className="panel-body">
      <form className="toolbar" onSubmit={search}><div className="search-box"><Search /><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Immatriculation ou VIN" aria-label="Immatriculation ou VIN" /></div><button className="button primary" type="submit"><Search />Rechercher</button>{filter && <button type="button" className="button" onClick={()=>{setFilter('');setQuery('');setSearched(false);}}>Effacer</button>}</form>
      <div className="callout" style={{ marginTop: 12 }}>Aucune interrogation de registre externe. Un véhicule ne sera trouvé que s’il figure dans vos données locales.</div>
    </div>
    {matched.length ? <div className="table-wrap"><table><thead><tr><th>Véhicule</th><th>Immatriculation / VIN</th><th>Motorisation</th><th>Source</th><th>État</th><th>Actions</th></tr></thead><tbody>{matched.map((v)=><tr key={v.id}><td><strong>{v.make || 'Marque non renseignée'} {v.model}</strong><div className="panel-caption">{v.version || 'Version non renseignée'}</div></td><td><div className="mono">{v.registration || '—'}</div><div className="mono">{v.vin || '—'}</div></td><td>{v.engine || '—'}</td><td>{v.source || 'Document importé'}</td><td><Status state={v.status} /></td><td><div className="toolbar">{v.status !== 'verified' && <button className="button green small" onClick={()=>void verify('vehicles',v.id)}><Check />Vérifier</button>}<button className="button danger small" aria-label="Supprimer le véhicule" onClick={()=>void deleteRecord('vehicles',v.id)}><X /></button></div></td></tr>)}</tbody></table></div> :
      <Empty icon={CarFront} title={db.vehicles.length ? 'Aucun véhicule correspondant' : 'Aucun véhicule importé'} text={db.vehicles.length ? 'Essayez une autre immatriculation ou un autre VIN.' : 'Importez un fichier structuré ou ajoutez un dossier attesté par votre catalogue.'} action={db.vehicles.length ? undefined : <button className="button primary small" onClick={()=>props.setModal('vehicle')}><Plus />Ajouter un véhicule</button>} />}
  </div>;
}

function Parts(props: PageProps) {
  const { db, filter, setFilter, logSearch, verify, deleteRecord } = props;
  const [query, setQuery] = useState('');
  const [type, setType] = useState('Tout');
  const matched = useMemo(() => db.parts.filter((p) => partMatches(p, filter, type)), [db.parts,filter,type]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const term = query.trim();
    setFilter(term);
    void logSearch(term, 'Pièce', db.parts.filter((p) => partMatches(p, term, type)).length);
  };
  return <div className="panel"><div className="panel-head"><div><div className="panel-title">Recherche de pièces</div><div className="panel-caption">Désignation, référence OE ou fabricant d’équipement</div></div><span className="status neutral">{db.parts.length} référence{db.parts.length > 1 ? 's' : ''}</span></div>
    <div className="panel-body"><form className="toolbar" onSubmit={submit}><div className="search-box"><Search /><input className="input" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Ex. désignation ou référence cataloguée" aria-label="Rechercher une pièce" /></div><select className="select" style={{width:130}} value={type} onChange={(e)=>setType(e.target.value)} aria-label="Type de référence"><option>Tout</option><option>OE</option><option>Fabricant</option></select><button className="button primary" type="submit"><Search />Rechercher</button>{filter && <button className="button" type="button" onClick={()=>{setFilter('');setQuery('');}}>Effacer</button>}</form>
      <div className="callout" style={{marginTop:12}}>Les références croisées ne sont pas déduites. Les résultats reproduisent uniquement les données présentes dans vos sources.</div></div>
    {matched.length ? <div className="table-wrap"><table><thead><tr><th>Désignation</th><th>Référence OE</th><th>Fabricant</th><th>Référence fabricant</th><th>Source / état</th><th>Action</th></tr></thead><tbody>{matched.map((p)=><tr key={p.id}><td><strong>{p.designation}</strong></td><td className="mono">{p.oe || '—'}</td><td>{p.brand || '—'}</td><td className="mono">{p.reference || '—'}</td><td>{p.source || 'Document importé'}<div style={{marginTop:5}}><Status state={p.status}/></div></td><td><div className="toolbar">{p.status !== 'verified' && <button className="button green small" onClick={()=>void verify('parts',p.id)}><Check />Vérifier</button>}<button className="button danger small" aria-label="Supprimer la référence" onClick={()=>void deleteRecord('parts',p.id)}><X /></button></div></td></tr>)}</tbody></table></div> :
      <Empty icon={Wrench} title={db.parts.length ? 'Aucune référence correspondante' : 'Aucune référence importée'} text={db.parts.length ? 'Essayez un autre terme, une référence OE ou une référence fabricant.' : 'Les références seront recherchables après import de votre catalogue.'} action={!db.parts.length ? <button className="button primary small" onClick={()=>props.setModal('part')}><Plus />Ajouter une référence</button> : undefined} />}
  </div>;
}

function Compatibilities({ db, verify, deleteRecord, setModal, decide }: PageProps & { decide: (id: string, authorized: boolean) => Promise<void> }) {
  const [filter, setFilter] = useState('all');
  const relationIsVerified = (c: Compatibility) => relationState(c, db) === 'verified';
  const relationStatus = (c: Compatibility) => relationState(c, db);
  const records = db.compatibilities.filter(c => filter === 'all' || (filter === 'pending' ? c.status !== 'verified' : c.status === 'verified'));
  return <div className="panel"><div className="panel-head"><div><div className="panel-title">Relations véhicule / pièce</div><div className="panel-caption">Les relations doivent être explicites et prouvées par une source</div></div><div className="toolbar"><select className="select" style={{width:155}} value={filter} onChange={(e)=>setFilter(e.target.value)} aria-label="Filtrer les compatibilités"><option value="all">Toutes les relations</option><option value="pending">À vérifier / STOP</option><option value="verified">Vérifiées</option></select></div></div>
    <div className="panel-body"><div className="callout warning">Une relation reçue n’est pas une confirmation. Seule une relation explicitement marquée vérifiée passe au statut vert. L’autorisation commerciale est une décision distincte.</div></div>
     {records.length ? <div className="table-wrap"><table><thead><tr><th>Véhicule</th><th>Pièce</th><th>Preuve source</th><th>Compatibilité</th><th>Décision autorisée</th><th>Actions</th></tr></thead><tbody>{records.map(c=>{const v=db.vehicles.find(x=>x.id===c.vehicleId);const p=db.parts.find(x=>x.id===c.partId);const verified=relationIsVerified(c);const state=relationStatus(c);return <tr key={c.id}><td>{v ? `${v.make} ${v.model}` : <span className="status stop">Véhicule manquant</span>}<div className="mono">{v?.registration || v?.vin || ''}</div></td><td>{p?.designation || <span className="status stop">Pièce manquante</span>}<div className="mono">{p?.oe || p?.reference || ''}</div></td><td>{c.source || 'Source non précisée'}</td><td>{state === 'stop' ? <Status kind="stop" /> : <Status kind={state === 'verified' ? 'verified' : 'pending'} />}</td><td>{c.authorized && verified ? <><Status kind="verified" state="verified"/><div className="panel-caption">Par {c.decisionBy} · {c.decisionAt ? fmtDate(c.decisionAt) : ''}</div></> : <span className="status neutral">Non autorisée</span>}</td><td><div className="toolbar">{!verified && <button className="button green small" onClick={()=>void verify('compatibilities',c.id)}><Check />Vérifier</button>}<button className="button small" onClick={()=>void decide(c.id,true)} disabled={!verified} title={!verified ? 'Vérifiez d’abord la relation' : 'Consigner une décision autorisée'}><BadgeCheck />Autoriser</button><button className="button danger small" onClick={()=>void deleteRecord('compatibilities',c.id)} aria-label="Supprimer la compatibilité"><X /></button></div></td></tr>})}</tbody></table></div> :
      <Empty icon={ClipboardCheck} title="Aucune compatibilité enregistrée" text="Sans relation explicite provenant de vos sources, PIÈCE-SÛRE affiche un arrêt et ne déduit aucune compatibilité." action={<button className="button primary small" onClick={()=>setModal('compat')}><Plus />Créer une relation depuis une preuve</button>} />}
  </div>;
}

function ConnectorList() {
  return <div className="panel-body">{CATALOG_PROVIDERS.map(provider=><div className="connector-row" key={provider.id}><div><strong>{provider.name}</strong><span>{provider.accessPolicy}</span></div><span className="connector-off">Non connecté</span></div>)}<div className="panel-caption" style={{lineHeight:1.5,marginTop:12}}>Aucun accès ni extraction n’est actif. Les connecteurs futurs devront passer par une API officielle ou un export autorisé.</div></div>;
}

function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon /></div><strong>{title}</strong><p>{text}</p>{action}</div>;
}

function RecordModal({ kind, db, onClose, onVehicle, onPart, onCompat }: { kind: 'vehicle' | 'part' | 'compat'; db: Tables; onClose: () => void; onVehicle: (v: Vehicle) => Promise<void>; onPart: (p: Part) => Promise<void>; onCompat: (c: Compatibility) => Promise<void> }) {
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(e.currentTarget).entries());
    try {
       if (kind === 'vehicle') {
         if (!clean(values.registration) && !clean(values.vin)) throw new Error('Renseignez au moins une immatriculation ou un numéro VIN.');
         await onVehicle({ id:uid(), registration:clean(values.registration), vin:clean(values.vin), make:clean(values.make), model:clean(values.model), engine:clean(values.engine), version:clean(values.version), source:clean(values.source), status:'received', receivedAt:now() });
       }
      if (kind === 'part') await onPart({ id:uid(), designation:clean(values.designation), oe:clean(values.oe), brand:clean(values.brand), reference:clean(values.reference), source:clean(values.source), status:'received', receivedAt:now() });
      if (kind === 'compat') await onCompat({ id:uid(), vehicleId:clean(values.vehicleId), partId:clean(values.partId), source:clean(values.source), status:'received', authorized:false, decisionBy:'', decisionAt:'' });
    } catch (err) { setError(err instanceof Error ? err.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  };
  const heading = kind === 'vehicle' ? 'Ajouter un véhicule' : kind === 'part' ? 'Ajouter une référence' : 'Créer une relation explicite';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div className="modal-head"><div><div className="eyebrow">ENREGISTREMENT LOCAL</div><div className="modal-title" id="modal-title">{heading}</div></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X /></button></div>
    <form onSubmit={(e)=>void submit(e)}>
      {kind === 'vehicle' && <div className="form-grid">
        <Field label="Immatriculation"><input className="input" name="registration" /></Field><Field label="Numéro VIN"><input className="input" name="vin" /></Field>
        <Field label="Marque"><input className="input" name="make" /></Field><Field label="Modèle"><input className="input" name="model" /></Field>
        <Field label="Motorisation"><input className="input" name="engine" /></Field><Field label="Version"><input className="input" name="version" /></Field>
        <Field label="Source / document"><input className="input" name="source" required placeholder="Nom du document catalogue" /></Field>
      </div>}
      {kind === 'part' && <div className="form-grid">
        <Field label="Désignation"><input className="input" name="designation" required /></Field><Field label="Référence OE"><input className="input" name="oe" /></Field>
        <Field label="Marque équipementier"><input className="input" name="brand" /></Field><Field label="Référence fabricant"><input className="input" name="reference" /></Field>
        <Field label="Source / document" className="full"><input className="input" name="source" required placeholder="Nom du document catalogue" /></Field>
      </div>}
      {kind === 'compat' && <div className="form-grid">
        <Field label="Véhicule" className="full"><select className="select" name="vehicleId" required defaultValue=""><option value="" disabled>Choisir un véhicule local</option>{db.vehicles.map(v=><option key={v.id} value={v.id}>{[v.registration,v.make,v.model,v.vin].filter(Boolean).join(' — ')}</option>)}</select></Field>
        <Field label="Pièce" className="full"><select className="select" name="partId" required defaultValue=""><option value="" disabled>Choisir une référence locale</option>{db.parts.map(p=><option key={p.id} value={p.id}>{[p.designation,p.oe,p.reference].filter(Boolean).join(' — ')}</option>)}</select></Field>
        <Field label="Source explicite de la relation" className="full"><input className="input" name="source" required placeholder="Document et page / ligne" /></Field>
        <div className="callout warning full">La relation commencera « À vérifier ». Cette saisie ne vaut pas validation commerciale.</div>
      </div>}
      {error && <div className="callout stop" style={{marginTop:12}} role="alert">{error}</div>}
      <div className="form-actions"><button type="button" className="button" onClick={onClose}>Annuler</button><button className="button primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer comme à vérifier'}</button></div>
    </form>
  </section></div>;
}
function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) { return <div className={`field ${className}`}><label>{label}</label>{children}</div>; }

function parseCsv(text: string): Record<string,string>[] {
  const lines = text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if (!lines.length) return [];
  const delimiter = lines[0].includes(';') ? ';' : ',';
  const parseLine = (line: string) => {
    const cells: string[]=[]; let cell=''; let quoted=false;
    for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'&&quoted&&line[i+1]==='"'){cell+='"';i++;}else if(ch==='"'){quoted=!quoted;}else if(ch===delimiter&&!quoted){cells.push(cell.trim());cell='';}else cell+=ch;}
    cells.push(cell.trim()); return cells;
  };
  const headers=parseLine(lines[0]).map(h=>norm(h).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''));
  return lines.slice(1).map(line=>{const cells=parseLine(line);return Object.fromEntries(headers.map((h,i)=>[h,cells[i]??'']));});
}
function valueOf(row: Record<string, unknown>, ...keys: string[]) {
  const normalized = Object.fromEntries(Object.entries(row).map(([k,v])=>[norm(k).replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),v]));
  for(const key of keys){const value=normalized[key];if(value!==undefined&&clean(value))return clean(value);}
  return '';
}
function asRows(json: unknown): Record<string,unknown>[] {
  if(Array.isArray(json)) return json.filter(x=>x&&typeof x==='object') as Record<string,unknown>[];
  if(json&&typeof json==='object'){
    const obj=json as Record<string,unknown>;
    for(const key of ['records','vehicles','parts','compatibilities','relations','data']) if(Array.isArray(obj[key])) return obj[key] as Record<string,unknown>[];
    return [obj];
  }
  return [];
}
function jsonRows(json: unknown): Record<string,unknown>[] {
  if(!json||typeof json!=='object'||Array.isArray(json)) return asRows(json);
  const obj=json as Record<string,unknown>;
  const sections:[string,string][]=[['vehicles','vehicle'],['vehicules','vehicle'],['parts','part'],['pieces','part'],['compatibilities','compatibility'],['compatibilites','compatibility'],['relations','compatibility']];
  const rows:Record<string,unknown>[]=[];
  for(const [key,type] of sections)if(Array.isArray(obj[key]))for(const row of obj[key] as Record<string,unknown>[])rows.push({record_type:type,...row});
  return rows.length?rows:asRows(json);
}
async function processStructuredFile(file: File): Promise<{vehicles:Vehicle[];parts:Part[];compatibilities:Compatibility[]}> {
  const text=await file.text();
  const parsed=file.name.toLowerCase().endsWith('.json') ? JSON.parse(text) as unknown : null;
  const rows=file.name.toLowerCase().endsWith('.json') ? jsonRows(parsed) : parseCsv(text);
  const result={vehicles:[] as Vehicle[],parts:[] as Part[],compatibilities:[] as Compatibility[]};
  for(const row of rows){
    const type=norm(valueOf(row,'record_type','type','entity','kind'));
    const hasVehicle=Boolean(valueOf(row,'registration','immatriculation','vin','vehicle_id','vehicule_id','vehicle_make','make','marque'));
     const hasPart=Boolean(valueOf(row,'designation','part_designation','name','libelle','oe_reference','reference_oe','oe','oem','part_id','part_reference','aftermarket_reference','reference_fabricant','reference','ref'));
    const source=valueOf(row,'source','source_name','document','filename','origine') || file.name;
    const isRelation=['compatibility','compatibilite','relation','fitment'].includes(type) || Boolean(valueOf(row,'vehicle_id','vehicule_id')&&valueOf(row,'part_id','piece_id'));
    if(isRelation){
      const vehicleId=valueOf(row,'vehicle_id','vehicule_id'); const partId=valueOf(row,'part_id','piece_id');
      if(vehicleId&&partId) result.compatibilities.push({id:uid(),vehicleId,partId,source,status:'received',authorized:false,decisionBy:'',decisionAt:''});
      continue;
    }
     if(['vehicle','vehicule','car'].includes(type)||(!type&&hasVehicle&&!hasPart)){
      result.vehicles.push({id:valueOf(row,'id','vehicle_id','vehicule_id')||uid(),registration:valueOf(row,'registration','immatriculation','plate'),vin:valueOf(row,'vin','numero_vin'),make:valueOf(row,'make','marque','vehicle_make'),model:valueOf(row,'model','modele','vehicle_model'),engine:valueOf(row,'engine','motorisation','motor'),version:valueOf(row,'version','trim'),source,status:'received',receivedAt:now()});
    }
    if(['part','piece','reference'].includes(type)||(!type&&hasPart&&!isRelation)){
      result.parts.push({id:valueOf(row,'id','part_id','piece_id')||uid(),designation:valueOf(row,'designation','part_designation','name','libelle'),oe:valueOf(row,'oe_reference','reference_oe','oe','oem','numero_oe'),brand:valueOf(row,'brand','marque_equipementier','manufacturer','fabricant'),reference:valueOf(row,'aftermarket_reference','reference_fabricant','manufacturer_reference','reference','ref'),source,status:'received',receivedAt:now()});
    }
  }
  return result;
}

function ImportPage({ db, refresh, notify }: { db: Tables; refresh: () => Promise<void>; notify: (s: string) => void }) {
  const inputRef=useRef<HTMLInputElement>(null);
  const [working,setWorking]=useState(false);
  const [error,setError]=useState('');
  const [lastResult,setLastResult]=useState('');
  const [origin,setOrigin]=useState('');
  const filesChanged = async (files: FileList | null) => {
    if(!files?.length)return;
    setWorking(true);setError('');setLastResult('');
    let importedRows=0;let docs=0;const failures:string[]=[];
    for(const file of Array.from(files)){
      const ext=file.name.split('.').pop()?.toLowerCase()||'';
      try {
        if(['csv','json'].includes(ext)){
          const parsed=await processStructuredFile(file);
          for(const v of parsed.vehicles)await put('vehicles',v);
          for(const p of parsed.parts)await put('parts',p);
          for(const c of parsed.compatibilities)await put('compatibilities',c);
          importedRows+=parsed.vehicles.length+parsed.parts.length+parsed.compatibilities.length;
          await put('documents',{id:uid(),filename:file.name,type:ext.toUpperCase(),origin:origin.trim()||file.name,importedAt:now(),size:file.size,fileBase64:await fileToBase64(file)});
          docs++;
          if(importedRows===0) failures.push(`${file.name} : aucune ligne reconnue. Vérifiez record_type/type et les en-têtes.`);
        } else if(['pdf','png','jpg','jpeg','webp','gif'].includes(ext)){
          await put('documents',{id:uid(),filename:file.name,type:ext.toUpperCase(),origin:origin.trim()||file.name,importedAt:now(),size:file.size,fileBase64:await fileToBase64(file)});
          docs++;
        } else failures.push(`${file.name} : format non pris en charge.`);
      } catch(e){failures.push(`${file.name} : ${e instanceof Error?e.message:'lecture impossible'}`);}
    }
    await refresh();setWorking(false);
    if(failures.length)setError(failures.join(' '));
    if(importedRows||docs){setLastResult(`${importedRows} enregistrement${importedRows>1?'s':''} structuré${importedRows>1?'s':''} ajouté${importedRows>1?'s':''} ; ${docs} document${docs>1?'s':''} conservé${docs>1?'s':''}.`);notify('Import local terminé. Les faits restent à vérifier.');}
  };
  const downloadTemplate=()=>{
    const content='record_type,registration,vin,make,model,engine,version,designation,oe_reference,brand,aftermarket_reference,source,vehicle_id,part_id\n';
    const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='structure-catalogue.csv';a.click();URL.revokeObjectURL(url);
  };
  return <div className="split-layout">
    <div style={{display:'grid',gap:15}}>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Données structurées</div><div className="panel-caption">CSV ou JSON · chaque fait importé commence « À vérifier »</div></div><FileJson2 size={16} color="#698b78" /></div><div className="panel-body">
        <div className="field" style={{marginBottom:13}}><label>Origine / nom du catalogue (facultatif)</label><input className="input" value={origin} onChange={e=>setOrigin(e.target.value)} placeholder="Ex. catalogue interne, édition…" /></div>
        <div className="dropzone" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();void filesChanged(e.dataTransfer.files);}}><Upload /><strong>Déposez vos fichiers catalogue ici</strong><p>CSV et JSON structurés. L’import est traité dans ce navigateur.</p><button className="button" onClick={()=>inputRef.current?.click()} disabled={working}>{working?'Import en cours…':'Choisir des fichiers'}</button><input ref={inputRef} id="catalog-upload" type="file" accept=".csv,.json,.pdf,.png,.jpg,.jpeg,.webp,.gif" multiple hidden onChange={e=>{void filesChanged(e.target.files);e.currentTarget.value='';}} /></div>
        <div className="form-actions" style={{justifyContent:'space-between'}}><span className="panel-caption">En-têtes reconnus : record_type, immatriculation, VIN, OE…</span><button className="button small" onClick={downloadTemplate}><ArrowDownToLine />Structure CSV</button></div>
        {lastResult&&<div className="callout" role="status" style={{marginTop:12}}>{lastResult}</div>}
        {error&&<div className="callout stop" role="alert" style={{marginTop:12}}>{error}</div>}
        <div className="callout warning" style={{marginTop:12}}>Les lignes CSV/JSON ajoutent des véhicules, pièces et relations lorsque leur type et leurs champs sont identifiables. Les relations utilisent les identifiants vehicle_id et part_id. Un PDF ou une image est conservé comme document de preuve ; aucune reconnaissance automatique de texte n’est effectuée.</div>
      </div></section>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Documents de preuve</div><div className="panel-caption">Fichiers stockés localement, sans extraction OCR</div></div><Archive size={16} color="#698b78" /></div>
        {db.documents.length ? <div className="panel-body file-list">{[...db.documents].sort((a,b)=>b.importedAt.localeCompare(a.importedAt)).map(doc=><div className="file-row" key={doc.id}><div className="file-type">{doc.type}</div><div className="file-details"><strong>{doc.filename}</strong><span>{doc.origin} · {fmtDate(doc.importedAt)} · {Math.max(1,Math.round(doc.size/1024))} Ko</span></div><Status kind="neutral" label="Document local" /><button className="icon-button" aria-label={`Ouvrir ${doc.filename}`} title="Ouvrir le document local" onClick={()=>{if(!doc.fileBlob && !doc.fileBase64)return;
const blob = doc.fileBase64
  ? new Blob(
      [Uint8Array.from(atob(doc.fileBase64), c => c.charCodeAt(0))],
      {type: doc.type === 'PDF' ? 'application/pdf' : 'application/octet-stream'}
    )
  : doc.fileBlob!;
const url=URL.createObjectURL(blob);const link=document.createElement('a');
link.href=url;
link.download=doc.filename;
document.body.appendChild(link);
link.click();
link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}}><ExternalLink /></button></div>)}</div> : <Empty icon={FileText} title="Aucun document conservé" text="Les PDF et images importés seront disponibles ici comme preuves catalogue." />}
      </section>
    </div>
    <aside style={{display:'grid',alignContent:'start',gap:15}}>
      <section className="panel"><div className="panel-head"><div><div className="panel-title">Connecteurs autorisés</div><div className="panel-caption">Architecture future, non activée</div></div><ShieldCheck size={15}/></div><ConnectorList /></section>
      <section className="panel"><div className="panel-head"><div className="panel-title">Règles de confiance</div><BookOpenCheck size={15}/></div><div className="panel-body" style={{display:'grid',gap:10}}><Rule text="Fait importé : statut « À vérifier »."/><Rule text="Relation explicite vérifiée : seule situation de compatibilité verte."/><Rule text="Donnée absente, ambiguë ou contradictoire : arrêt, jamais de déduction."/><Rule text="Décision commerciale autorisée : action distincte, attribuée à une personne." /></div></section>
    </aside>
  </div>;
}
function Rule({text}:{text:string}){return <div style={{display:'flex',gap:8,alignItems:'flex-start',fontSize:10,color:'#627583',lineHeight:1.5}}><Check size={13} color="#4c906c" style={{flexShrink:0,marginTop:1}}/>{text}</div>}

type ChatMessage={role:'assistant'|'user';text:string;sources?:string[]};
function Assistant({db,logSearch}:PageProps) {
  const [question,setQuestion]=useState('');
  const [messages,setMessages]=useState<ChatMessage[]>([{role:'assistant',text:'Je consulte uniquement les véhicules, pièces et relations présents dans votre base locale. Je ne fais pas appel à un modèle génératif externe. Posez une question ou saisissez une référence.'}]);
  const [busy,setBusy]=useState(false);
  const answer=(query:string):ChatMessage=>{
    const q=norm(query.trim());
    if(!q)return{role:'assistant',text:'Saisissez une immatriculation, un VIN, une désignation ou une référence pour lancer une recherche locale.'};
    const vehicles=db.vehicles.filter(v=>norm([v.registration,v.vin,v.make,v.model,v.engine,v.version].join(' ')).includes(q)||q.split(/\s+/).filter(t=>t.length>2).some(t=>norm([v.registration,v.vin,v.make,v.model,v.engine,v.version].join(' ')).includes(t)));
    const parts=db.parts.filter(p=>norm([p.designation,p.oe,p.brand,p.reference].join(' ')).includes(q)||q.split(/\s+/).filter(t=>t.length>2).some(t=>norm([p.designation,p.oe,p.brand,p.reference].join(' ')).includes(t)));
    const sources=[...new Set([...vehicles.map(v=>v.source),...parts.map(p=>p.source)].filter(Boolean))];
    const lines:string[]=[];
    if(vehicles.length)lines.push(`${vehicles.length} véhicule${vehicles.length>1?'s':''} trouvé${vehicles.length>1?'s':''} dans les données locales : ${vehicles.slice(0,4).map(v=>`${v.registration||v.vin||'Identifiant absent'} — ${[v.make,v.model,v.engine].filter(Boolean).join(' ')||'détails non renseignés'} (${v.status==='verified'?'vérifié':'à vérifier'})`).join(' ; ')}.`);
    if(parts.length)lines.push(`${parts.length} référence${parts.length>1?'s':''} pièce trouvée${parts.length>1?'s':''} : ${parts.slice(0,5).map(p=>`${p.designation||'Désignation absente'} — OE ${p.oe||'non renseignée'} — ${p.brand||''} ${p.reference||''} (${p.status==='verified'?'vérifiée':'à vérifier'})`).join(' ; ')}.`);
    const vehiclesForRelations=vehicles.length?vehicles:db.vehicles.filter(v=>q.includes(norm(v.registration))&&v.registration||q.includes(norm(v.vin))&&v.vin);
    const partsForRelations=parts.length?parts:db.parts.filter(p=>(p.oe&&q.includes(norm(p.oe)))||(p.reference&&q.includes(norm(p.reference))));
     const rels=db.compatibilities.filter(c=>vehiclesForRelations.some(v=>v.id===c.vehicleId)||partsForRelations.some(p=>p.id===c.partId));
     if(rels.length)lines.push(`Relations explicites correspondantes : ${rels.map(c=>{const p=db.parts.find(x=>x.id===c.partId);const v=db.vehicles.find(x=>x.id===c.vehicleId);const state=relationState(c,db);return `${v?.make||''} ${v?.model||''} / ${p?.designation||'pièce'} — ${state==='verified'?'🟢 relation vérifiée':state==='pending'?'🟠 à vérifier':'🔴 STOP'} — preuve : ${c.source||'non précisée'}`;}).join(' ; ')}.`);
    if(!vehicles.length&&!parts.length&&!rels.length)lines.push('Je ne peux pas déterminer la réponse : aucun enregistrement correspondant n’a été trouvé dans vos données locales. Importez une source catalogue ou vérifiez la saisie.');
    if(vehicles.length>1||parts.length>1)lines.push('Plusieurs correspondances existent. Vérifiez les identifiants et la source avant toute décision.');
    if(sources.length)lines.push(`Source${sources.length>1?'s':''} : ${sources.join(', ')}.`);
    lines.push('Aucune compatibilité ni décision commerciale n’est déduite par cet assistant.');
    return{role:'assistant',text:lines.join(' '),sources};
  };
  const submit=async(e:FormEvent)=>{e.preventDefault();const q=question.trim();if(!q||busy)return;setMessages(prev=>[...prev,{role:'user',text:q}]);setQuestion('');setBusy(true);await new Promise(resolve=>window.setTimeout(resolve,160));const result=answer(q);setMessages(prev=>[...prev,result]);await logSearch(q,'Assistant local',0);setBusy(false);};
  const suggestions=['Une référence OE précise','Une immatriculation','Une désignation de pièce'];
  return <div className="assistant-layout"><section className="panel chat-area"><div className="chat-head"><div style={{display:'flex',alignItems:'center',gap:10}}><div className="quick-icon"><Sparkles /></div><div><div className="panel-title">Assistant de recherche locale</div><div className="panel-caption">Déterministe · citations issues des sources importées</div></div></div></div>
    <div className="chat-messages" aria-live="polite">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.text}{m.sources?.length? <div>{m.sources.map(s=><span className="source-chip" key={s}>{s}</span>)}</div>:null}</div>)}{busy&&<div className="message assistant">Recherche dans les données locales…</div>}</div>
    <form className="chat-form" onSubmit={(e)=>void submit(e)}><input className="input" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Saisissez une référence, un VIN ou une question…" aria-label="Question à l’assistant" /><button className="button primary" disabled={!question.trim()||busy} aria-label="Envoyer"><ArrowRight /></button></form>
  </section><aside style={{display:'grid',alignContent:'start',gap:13}}><section className="panel"><div className="panel-head"><div className="panel-title">Périmètre</div><Database size={15}/></div><div className="panel-body" style={{display:'grid',gap:12}}><div className="callout">Traitement entièrement local. Aucun modèle génératif externe, aucun service réseau, aucune donnée véhicule devinée.</div><div style={{fontSize:10,color:'#6b7d89',lineHeight:1.6}}>L’assistant recherche des correspondances textuelles dans les dossiers importés. Il cite les noms de sources disponibles et signale l’absence, la multiplicité ou l’incertitude.</div></div></section><section className="panel"><div className="panel-head"><div className="panel-title">Essayez une recherche</div></div><div className="panel-body" style={{display:'grid',gap:7}}>{suggestions.map(s=><button key={s} className="button" style={{justifyContent:'flex-start'}} onClick={()=>setQuestion(s)}>{s}<ArrowRight size={12}/></button>)}</div></section></aside></div>;
}

function HistoryPage({db,notify,refresh}:PageProps & {refresh:()=>Promise<void>}) {
  const sorted=[...db.history].sort((a,b)=>b.at.localeCompare(a.at));
  const clear=async()=>{if(!window.confirm('Effacer tout l’historique local ?'))return;for(const record of db.history)await remove('history',record.id);await refresh();notify('Historique effacé.');};
  return <section className="panel"><div className="panel-head"><div><div className="panel-title">Recherches récentes</div><div className="panel-caption">{db.history.length} recherche{db.history.length>1?'s':''} enregistrée{db.history.length>1?'s':''} sur cet appareil</div></div>{db.history.length>0&&<button className="button danger small" onClick={()=>void clear()}><X />Effacer l’historique</button>}</div>
    {sorted.length?<div className="table-wrap"><table><thead><tr><th>Terme recherché</th><th>Type</th><th>Résultats</th><th>Date et heure</th></tr></thead><tbody>{sorted.map(h=><tr key={h.id}><td><strong>{h.query}</strong></td><td>{h.kind}</td><td>{h.count}</td><td>{fmtDate(h.at)}</td></tr>)}</tbody></table></div>:<Empty icon={History} title="Votre historique est vide" text="Les recherches effectuées sur les véhicules, pièces et dans l’assistant apparaîtront ici." />}
  </section>;
}

export default App;
