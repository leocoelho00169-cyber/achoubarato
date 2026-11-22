'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Search, Share2, ExternalLink, PlusCircle, Lock, Trash2, BarChart3, Tag, Upload } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const LOJAS = ['Todas', 'Shopee', 'Amazon', 'Mercado Livre', 'Netshoes', 'AliExpress', 'Magalu'];
const SENHA_ADMIN = 'admin123'; // Você pode trocar essa senha depois

export default function AchouBaratoApp() {
  const [ofertas, setOfertas] = useState([]);
  const [lojaSelecionada, setLojaSelecionada] = useState('Todas');
  const [busca, setBusca] = useState('');
  const [modoAdmin, setModoAdmin] = useState(false);
  const [autenticado, setAutenticado] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  // Campos do formulário Admin
  const [titulo, setTitulo] = useState('');
  const [loja, setLoja] = useState('Shopee');
  const [precoOriginal, setPrecoOriginal] = useState('');
  const [precoOferta, setPrecoOferta] = useState('');
  const [linkAfiliado, setLinkAfiliado] = useState('');
  const [arquivoImagem, setArquivoImagem] = useState(null);

  useEffect(() => {
    carregarOfertas();
  }, []);

  async function carregarOfertas() {
    if (!supabase) {
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const { data, error } = await supabase
      .from('ofertas')
      .select('*')
      .eq('ativa', true)
      .order('created_at', { ascending: false });

    if (!error && data) setOfertas(data);
    setCarregando(false);
  }

  async function registrarClique(oferta) {
    if (supabase) {
      await supabase
        .from('ofertas')
        .update({ cliques: (oferta.cliques || 0) + 1 })
        .eq('id', oferta.id);
      carregarOfertas();
    }
    window.open(oferta.link_afiliado, '_blank');
  }

  function compartilharWhatsApp(oferta) {
    const precoFmt = Number(oferta.preco_oferta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const texto = `🔥 *ACHOU BARATO!* 🔥\n\n*${oferta.titulo}*\n🏪 Loja: ${oferta.loja}\n💰 Por apenas: *${precoFmt}*\n\n👇 Pegue aqui:\n${oferta.link_afiliado}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`, '_blank');
  }

  async function cadastrarOferta(e) {
    e.preventDefault();
    if (!supabase || !arquivoImagem) return alert('Selecione uma imagem e verifique a conexão.');
    setEnviando(true);

    try {
      const nomeArquivo = `${Date.now()}-${arquivoImagem.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
      const { error: uploadError } = await supabase.storage
        .from('imagens-produtos')
        .upload(nomeArquivo, arquivoImagem);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('imagens-produtos')
        .getPublicUrl(nomeArquivo);

      const { error: insertError } = await supabase.from('ofertas').insert([{
        titulo,
        loja,
        preco_original: precoOriginal ? parseFloat(precoOriginal) : null,
        preco_oferta: parseFloat(precoOferta),
        link_afiliado: linkAfiliado,
        imagem_url: urlData.publicUrl,
        cliques: 0,
        ativa: true
      }]);

      if (insertError) throw insertError;

      setTitulo('');
      setPrecoOriginal('');
      setPrecoOferta('');
      setLinkAfiliado('');
      setArquivoImagem(null);
      alert('Oferta publicada com sucesso!');
      carregarOfertas();
    } catch (err) {
      alert('Erro ao publicar: ' + err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function excluirOferta(id) {
    if (!confirm('Remover esta oferta?')) return;
    await supabase.from('ofertas').delete().eq('id', id);
    carregarOfertas();
  }

  const ofertasFiltradas = ofertas.filter((item) => {
    const bateLoja = lojaSelecionada === 'Todas' || item.loja === lojaSelecionada;
    const bateBusca = item.titulo.toLowerCase().includes(busca.toLowerCase());
    return bateLoja && bateBusca;
  });

  const totalCliques = ofertas.reduce((acc, item) => acc + (item.cliques || 0), 0);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f4f4f5', minHeight: '100vh', paddingBottom: '60px' }}>
      {/* Cabeçalho */}
      <header style={{ backgroundColor: '#ea580c', color: 'white', padding: '16px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={24} />
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px' }}>AchouBarato</h1>
          </div>
          <button
            onClick={() => setModoAdmin(!modoAdmin)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Lock size={16} /> {modoAdmin ? 'Ver Loja' : 'Admin'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '16px' }}>
        {modoAdmin ? (
          /* PAINEL ADMIN */
          !autenticado ? (
            <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', maxWidth: '400px', margin: '40px auto', textAlign: 'center' }}>
              <h2 style={{ marginTop: 0 }}>Acesso Restrito</h2>
              <input
                type="password"
                placeholder="Digite a senha do Admin"
                value={senhaInput}
                onChange={(e) => setSenhaInput(e.target.value)}
                style={{ width: '100%', padding: '12px', marginBottom: '12px', borderRadius: '8px', border: '1px solid #d4d4d8', boxSizing: 'border-box' }}
              />
              <button
                onClick={() => senhaInput === SENHA_ADMIN ? setAutenticado(true) : alert('Senha incorreta!')}
                style={{ width: '100%', padding: '12px', backgroundColor: '#ea580c', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Entrar no Painel
              </button>
            </div>
          ) : (
            <div>
              {/* Métricas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#71717a', fontSize: '13px' }}>Ofertas Ativas</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#18181b' }}>{ofertas.length}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div style={{ color: '#71717a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><BarChart3 size={14}/> Total de Cliques</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}>{totalCliques}</div>
                </div>
              </div>

              {/* Formulário de Cadastro */}
              <form onSubmit={cadastrarOferta} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h2 style={{ marginTop: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20} color="#ea580c"/> Novo Achadinho</h2>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <input required placeholder="Título do produto (ex: Fone Bluetooth Lenovo)" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8' }} />
                  
                  <select value={loja} onChange={(e) => setLoja(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8' }}>
                    {LOJAS.filter(l => l !== 'Todas').map(l => <option key={l} value={l}>{l}</option>)}
                  </select>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input type="number" step="0.01" placeholder="Preço Antigo (opcional)" value={precoOriginal} onChange={(e) => setPrecoOriginal(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8' }} />
                    <input required type="number" step="0.01" placeholder="Preço Oferta (R$)" value={precoOferta} onChange={(e) => setPrecoOferta(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8' }} />
                  </div>

                  <input required type="url" placeholder="Cole seu Link de Afiliado aqui" value={linkAfiliado} onChange={(e) => setLinkAfiliado(e.target.value)} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #d4d4d8' }} />

                  <label style={{ border: '2px dashed #d4d4d8', padding: '16px', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', color: '#52525b' }}>
                    <Upload size={20} style={{ marginBottom: '4px' }} /><br/>
                    {arquivoImagem ? arquivoImagem.name : 'Clique para escolher a foto do produto'}
                    <input type="file" accept="image/*" required onChange={(e) => setArquivoImagem(e.target.files[0])} style={{ display: 'none' }} />
                  </label>

                  <button disabled={enviando} type="submit" style={{ padding: '14px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}>
                    {enviando ? 'Publicando...' : 'Publicar Achadinho'}
                  </button>
                </div>
              </form>

              {/* Lista para Gerenciar */}
              <h3>Gerenciar Ofertas Publicadas</h3>
              {ofertas.map(item => (
                <div key={item.id} style={{ backgroundColor: 'white', padding: '12px', borderRadius: '8px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>{item.titulo}</strong> <span style={{ fontSize: '12px', backgroundColor: '#f4f4f5', padding: '2px 6px', borderRadius: '4px' }}>{item.loja}</span>
                    <div style={{ fontSize: '13px', color: '#16a34a' }}>R$ {item.preco_oferta} • <strong>{item.cliques || 0} cliques</strong></div>
                  </div>
                  <button onClick={() => excluirOferta(item.id)} style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          /* VITRINE PÚBLICA */
          <div>
            {/* Barra de Busca */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={18} color="#71717a" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="text"
                placeholder="Buscar achadinhos..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '10px', border: '1px solid #e4e4e7', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Filtro de Lojas */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '12px', marginBottom: '8px' }}>
              {LOJAS.map((l) => (
                <button
                  key={l}
                  onClick={() => setLojaSelecionada(l)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    backgroundColor: lojaSelecionada === l ? '#ea580c' : 'white',
                    color: lojaSelecionada === l ? 'white' : '#3f3f46',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  {l}
                </button>
              ))}
            </div>

            {/* Grade de Produtos */}
            {carregando ? (
              <p style={{ textAlign: 'center', color: '#71717a', marginTop: '40px' }}>Carregando achadinhos...</p>
            ) : ofertasFiltradas.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#71717a', marginTop: '40px' }}>Nenhuma oferta encontrada no momento.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {ofertasFiltradas.map((item) => (
                  <div key={item.id} style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ position: 'relative', height: '200px', backgroundColor: '#fafafa' }}>
                      <img src={item.imagem_url} alt={item.titulo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      <span style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: '#18181b', color: 'white', fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px' }}>
                        {item.loja}
                      </span>
                    </div>
                    <div style={{ padding: '14px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', color: '#18181b', lineHeight: '1.3' }}>{item.titulo}</h3>
                        {item.preco_original && (
                          <div style={{ fontSize: '12px', color: '#a1a1aa', textDecoration: 'line-through' }}>
                            De {Number(item.preco_original).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        )}
                        <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a', marginBottom: '12px' }}>
                          {Number(item.preco_oferta).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => registrarClique(item)}
                          style={{ flex: 1, backgroundColor: '#ea580c', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                        >
                          Pegar Oferta <ExternalLink size={16} />
                        </button>
                        <button
                          onClick={() => compartilharWhatsApp(item)}
                          title="Enviar no WhatsApp"
                          style={{ backgroundColor: '#25D366', color: 'white', border: 'none', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Share2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
