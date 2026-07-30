new Swiper('.screenshots .swiper', {
  slidesPerView: 1,
  spaceBetween: 32,
  loop: true,
  speed: 600,
  grabCursor: true,
  autoplay: {
    delay: 6000,
    disableOnInteraction: false,
    pauseOnMouseEnter: true,
  },
  pagination: {
    el: '.swiper-pagination',
    clickable: true,
  },
  navigation: {
    nextEl: '.swiper-button-next',
    prevEl: '.swiper-button-prev',
  },
});
