-- À exécuter dans Supabase : Project > SQL Editor > New query > coller > Run

create table if not exists reports (
  id text primary key,
  photo_before text not null,
  photo_after text not null,
  location_label text not null,
  lat double precision,
  lng double precision,
  description text,
  status text not null default 'dirty',
  created_at bigint not null,
  updated_at bigint not null
);

-- Active la sécurité au niveau des lignes, puis autorise l'accès public
-- (lecture/écriture ouverte à tous — adapté à une démo/pilote, pas à une
-- production sensible : ajoutez une vraie authentification avant d'ouvrir
-- l'app à grande échelle).
alter table reports enable row level security;

create policy "Lecture publique" on reports
  for select using (true);

create policy "Création publique" on reports
  for insert with check (true);

create policy "Mise à jour publique du statut" on reports
  for update using (true);

-- Active les mises à jour en temps réel (pour que les autres utilisateurs
-- voient les nouveaux signalements sans recharger la page).
alter publication supabase_realtime add table reports;
