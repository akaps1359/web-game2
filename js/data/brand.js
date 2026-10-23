// 게임 이름(임시 제목). 바꾸면 node tools/build-fonts.mjs로 로고 글꼴을 다시 받는다
export const BRAND = { title: 'History', sub: 'Strategy Simulation', years: '1936 – 1945' };
// 로고 글꼴(구글 폰트, SIL OFL): 제목은 로마 비문 대문자(Cinzel), 부제는 우아한 이탤릭(Cormorant Garamond)
export const LOGO_FONTS = {
  logo: ['Cinzel', 'wght@700', BRAND.title + BRAND.title.toUpperCase()],
  logosub: ['Cormorant Garamond', 'ital,wght@1,600', BRAND.sub + BRAND.years + '·'],
};
