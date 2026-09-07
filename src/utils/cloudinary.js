/**
 * Recebe uma URL de imagem do Cloudinary (como vem do upload de fotos do
 * cadastro de empresa) e devolve uma versão redimensionada e otimizada:
 * preenche um retângulo fixo (corta o excesso, focando automaticamente no
 * "miolo" da imagem — g_auto), com formato e qualidade escolhidos
 * automaticamente pelo Cloudinary (menor arquivo possível sem perder
 * qualidade visível).
 *
 * Com isso, não importa se a pessoa manda uma foto quadrada (feed), vertical
 * (stories) ou horizontal — todas aparecem do mesmo tamanho no site, sem
 * ficar gigante nem distorcida.
 *
 * Se a URL não for do Cloudinary (ou já vier sem o "/upload/" esperado),
 * devolve ela sem mexer, pra nunca quebrar uma imagem por acidente.
 */
export function otimizarFotoCloudinary(url, { largura = 400, altura = 300 } = {}) {
  if (!url || !url.includes('/upload/')) return url;
  const transformacao = `c_fill,g_auto,w_${largura},h_${altura},q_auto,f_auto`;
  return url.replace('/upload/', `/upload/${transformacao}/`);
}
