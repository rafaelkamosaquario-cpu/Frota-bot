// ============================================================================
// Migração: criptografa (AES-256-GCM, ver lib/crypto.js) as credenciais que
// hoje estão em claro no banco -- empresas.zapi_instance_id/token/client_token
// e google_conexoes.access_token/refresh_token.
//
// Idempotente: cada valor já criptografado (prefixo "enc:v1:") é pulado, então
// rodar o script várias vezes (ou depois de já ter rodado) não faz nada de novo.
//
// Uso (na máquina/ambiente com as variáveis já configuradas):
//   node scripts/migrate-encrypt.mjs
//
// Requer: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ENCRYPTION_KEY.
// ============================================================================
import { supabaseEnabled, getClient } from "../db/supabase.js";
import { encrypt, isEncrypted } from "../lib/crypto.js";

if (!supabaseEnabled) {
  console.error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de rodar este script.");
  process.exit(1);
}
if (!process.env.ENCRYPTION_KEY) {
  console.error("Configure ENCRYPTION_KEY antes de rodar este script (ver lib/crypto.js).");
  process.exit(1);
}

const supabase = getClient();

async function migrarEmpresas() {
  const { data, error } = await supabase.from("empresas").select("id, zapi_instance_id, zapi_instance_token, zapi_client_token");
  if (error) throw new Error("Falha ao ler empresas: " + error.message);

  let atualizadas = 0, jaCriptografadas = 0, vazias = 0;
  for (const row of data || []) {
    const campos = ["zapi_instance_id", "zapi_instance_token", "zapi_client_token"];
    const algumEmClaro = campos.some((c) => row[c] && !isEncrypted(row[c]));
    const todasVazias = campos.every((c) => !row[c]);
    if (todasVazias) { vazias++; continue; }
    if (!algumEmClaro) { jaCriptografadas++; continue; }

    const update = {};
    for (const c of campos) {
      if (row[c] && !isEncrypted(row[c])) update[c] = encrypt(row[c]);
    }
    const { error: updErr } = await supabase.from("empresas").update(update).eq("id", row.id);
    if (updErr) throw new Error(`Falha ao atualizar empresa ${row.id}: ${updErr.message}`);
    atualizadas++;
  }
  console.log(`empresas: ${atualizadas} criptografada(s) agora, ${jaCriptografadas} já estavam, ${vazias} sem credencial.`);
}

async function migrarGoogle() {
  const { data, error } = await supabase.from("google_conexoes").select("empresa_id, access_token, refresh_token");
  if (error) throw new Error("Falha ao ler google_conexoes: " + error.message);

  let atualizadas = 0, jaCriptografadas = 0, vazias = 0;
  for (const row of data || []) {
    const campos = ["access_token", "refresh_token"];
    const algumEmClaro = campos.some((c) => row[c] && !isEncrypted(row[c]));
    const todasVazias = campos.every((c) => !row[c]);
    if (todasVazias) { vazias++; continue; }
    if (!algumEmClaro) { jaCriptografadas++; continue; }

    const update = {};
    for (const c of campos) {
      if (row[c] && !isEncrypted(row[c])) update[c] = encrypt(row[c]);
    }
    const { error: updErr } = await supabase.from("google_conexoes").update(update).eq("empresa_id", row.empresa_id);
    if (updErr) throw new Error(`Falha ao atualizar google_conexoes ${row.empresa_id}: ${updErr.message}`);
    atualizadas++;
  }
  console.log(`google_conexoes: ${atualizadas} criptografada(s) agora, ${jaCriptografadas} já estavam, ${vazias} sem token.`);
}

async function run() {
  console.log("Migrando credenciais para o formato criptografado (enc:v1:...)...\n");
  await migrarEmpresas();
  await migrarGoogle();
  console.log("\nConcluído. Rodar de novo é seguro (idempotente) -- nada em claro será perdido, só passa a ficar cifrado.");
}

run().catch((e) => { console.error("Falha na migração:", e.message); process.exit(1); });
