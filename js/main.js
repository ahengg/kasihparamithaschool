(function ($) {
    "use strict";

    // Initiate the wowjs
    new WOW().init();


    // Spinner
    var spinner = function () {
        setTimeout(function () {
            if ($('#spinner').length > 0) {
                $('#spinner').removeClass('show');
            }
        }, 1);
    };
    spinner();


    // Sticky Navbar
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.sticky-top').addClass('shadow-sm').css('top', '0px');
        } else {
            $('.sticky-top').removeClass('shadow-sm').css('top', '-100px');
        }
    });
    
    
    // Back to top button
    $(window).scroll(function () {
        if ($(this).scrollTop() > 300) {
            $('.back-to-top').fadeIn('slow');
        } else {
            $('.back-to-top').fadeOut('slow');
        }
    });
    $('.back-to-top').click(function () {
        $('html, body').animate({scrollTop: 0}, 1500, 'easeInOutExpo');
        return false;
    });


    // Header carousel
    $(".header-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1500,
        items: 1,
        dots: true,
        loop: true,
        nav : true,
        navText : [
            '<i class="bi bi-chevron-left"></i>',
            '<i class="bi bi-chevron-right"></i>'
        ]
    });


    // Testimonials carousel
    $(".testimonial-carousel").owlCarousel({
        autoplay: true,
        smartSpeed: 1000,
        margin: 24,
        dots: false,
        loop: true,
        nav : true,
        navText : [
            '<i class="bi bi-arrow-left"></i>',
            '<i class="bi bi-arrow-right"></i>'
        ],
        responsive: {
            0:{
                items:1
            },
            992:{
                items:2
            }
        }
    });


    // Smooth scroll to section with hash in URL
    $(window).on('load', function() {
        if (window.location.hash) {
            setTimeout(function() {
                var target = $(window.location.hash);
                if (target.length) {
                    var offset = 100; // Offset untuk navbar sticky
                    $('html, body').animate({
                        scrollTop: target.offset().top - offset
                    }, 1000, 'easeInOutExpo');
                }
            }, 500);
        }
    });


    // Smooth scroll untuk link dengan hash
    $('a[href*="#"]').on('click', function(e) {
        var hash = this.hash;
        
        // Cek apakah hash ada dan bukan untuk collapse/dropdown
        if (hash && !$(this).attr('data-bs-toggle')) {
            var target = $(hash);
            
            if (target.length) {
                e.preventDefault();
                var offset = 100; // Offset untuk navbar sticky
                
                $('html, body').animate({
                    scrollTop: target.offset().top - offset
                }, 1000, 'easeInOutExpo');
                
                // Update URL tanpa jump
                if (history.pushState) {
                    history.pushState(null, null, hash);
                }
            }
        }
    });
    
})(jQuery);