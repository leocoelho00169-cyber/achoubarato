export const metadata = {
  title: 'AchouBarato - Melhores Ofertas e Achadinhos',
  description: 'As melhores promoções da Shopee, Amazon, Mercado Livre, Netshoes, AliExpress e Magalu.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
