-- PIÈCE-SÛRE AI — PostgreSQL
-- v1.0.0 | 2026-11-10

-- VÉHICULE
CREATE TABLE vehicules (
  id SERIAL PRIMARY KEY,
  immatriculation TEXT NOT NULL,
  vin TEXT,
  ktype TEXT,
  kba TEXT,
  moteur TEXT,
  puissance_kw INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- PIÈCE
CREATE TABLE pieces (
  id SERIAL PRIMARY KEY,
  reference TEXT NOT NULL,
  marque TEXT NOT NULL,
  type TEXT CHECK (type IN ('OE','AFTERMARKET')),
  dimensions JSONB,
  wva TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SOURCES
CREATE TABLE sources (
  id SERIAL SERIAL,
  nom TEXT NOT NULL,
  url TEXT,
  type TEXT,
  niveau_confiance TEXT CHECK (niveau_confiance IN ('N0','N1','N2','N3')),
  date_consultation TIMESTAMPTZ DEFAULT now()
);

-- CROISEMENT OE ↔ AFTERMARKET (correspondance, pas compatibilité véhicule)
CREATE TABLE correspondances (
  id SERIAL PRIMARY KEY,
  piece_source_id INT REFERENCES pieces(id),
  piece_cible_id INT REFERENCES pieces(id),
  source_id INT REFERENCES sources(id),
  niveau TEXT CHECK (niveau IN ('N0','N1','N2','N3')),
  date_verification TIMESTAMPTZ DEFAULT now(),
  restriction TEXT
);

-- APPLICATION VÉHICULE-PIÈCE (preuve de compatibilité)
CREATE TABLE applications (
  id SERIAL PRIMARY KEY,
  vehicule_id INT REFERENCES vehicules(id),
  piece_id INT REFERENCES pieces(id),
  position TEXT,
  source_id INT REFERENCES sources(id),
  niveau TEXT CHECK (niveau IN ('N0','N1','N2','N3')),
  date_verification TIMESTAMPTZ DEFAULT now(),
  restriction TEXT
);

-- DOSSIERS
CREATE TABLE dossiers (
  id SERIAL PRIMARY KEY,
  numero TEXT UNIQUE NOT NULL,
  vehicule_id INT REFERENCES vehicules(id),
  piece_demandee TEXT,
  statut TEXT DEFAULT 'BROUILLON',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ÉVÉNEMENTS (journal, ajout seul)
CREATE TABLE evenements (
  id BIGSERIAL PRIMARY KEY,
  dossier_id INT REFERENCES dossiers(id),
  type TEXT NOT NULL,
  detail JSONB,
  auteur TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
