-- Rate limit de login (A3): registra toda tentativa (sucesso ou falha) pra
-- poder contar falhas recentes por username OU por ip antes de validar a
-- senha. Sem empresa_id -- login é resolvido por username global (ver
-- usuariosRepo.findByUsername, sem filtro de empresa), então o limite
-- também precisa ser global. Tabela só de leitura/append pelo backend
-- (service_role) -- limpeza de linhas com mais de 24h roda dentro do próprio
-- processo (setInterval em server.js), não como job do Postgres.
create table if not exists login_tentativas (
  id         uuid primary key default gen_random_uuid(),
  username   text not null,
  ip         text not null default '',
  sucesso    boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_login_tentativas_username on login_tentativas (username, created_at desc);
create index if not exists idx_login_tentativas_ip on login_tentativas (ip, created_at desc);
alter table login_tentativas enable row level security;

notify pgrst, 'reload schema';
