-- Cota de IA por empresa (A4): limite mensal de chamadas à Zappy IA e trava
-- manual de emergência, independente do limite. 300/mês é generoso o
-- suficiente pro uso real hoje (ver ia_consumo) sem custo indefinido por
-- empresa nova conectada sem acompanhamento.
alter table empresas add column if not exists ia_limite_mensal integer not null default 300;
alter table empresas add column if not exists ia_bloqueada boolean not null default false;

notify pgrst, 'reload schema';
