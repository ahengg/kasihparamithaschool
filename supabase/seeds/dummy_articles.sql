-- ============================================================
-- Dummy data: artikel publik & pengumuman
-- Jalankan di: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- Skrip ini menyisipkan:
--   • 6 artikel publik   (type='article',      audience_category_id NULL)
--   • 6 pengumuman publik (type='announcement', audience_category_id NULL)
--
-- Idempotent: pakai ON CONFLICT (slug) DO NOTHING — aman di-rerun.
-- user_id otomatis ambil dari user dengan role admin/editor pertama.
-- Kalau belum ada user admin/editor, skrip akan gagal dengan pesan jelas.

DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT u.id INTO uid
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE r.role_name IN ('admin', 'editor')
  ORDER BY u.created_at ASC
  LIMIT 1;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Tidak ada user dengan role admin/editor. Bikin dulu lewat manage_users.html.';
  END IF;

  -- ── 6 ARTIKEL PUBLIK ──────────────────────────────────────
  INSERT INTO public.articles (title, slug, content, status, type, audience_category_id, user_id, created_at)
  VALUES
    (
      'Selamat Datang di Tahun Ajaran Baru 2026/2027',
      'selamat-datang-tahun-ajaran-2026-2027',
      '<p>Kasih Paramitha School dengan bangga menyambut seluruh siswa, orang tua, dan guru di tahun ajaran baru 2026/2027. Mari kita awali tahun ini dengan semangat belajar dan kebersamaan yang baru.</p><p>Berbagai program menarik telah kami siapkan, mulai dari kegiatan akademik hingga pengembangan karakter. Kami percaya setiap anak memiliki potensi unik yang siap berkembang.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '1 day'
    ),
    (
      'Kunjungan Edukasi ke Museum Nasional',
      'kunjungan-edukasi-museum-nasional',
      '<p>Siswa kelas TKA dan TKB melakukan kunjungan edukasi ke Museum Nasional pada minggu lalu. Anak-anak sangat antusias melihat berbagai koleksi sejarah dan budaya Indonesia.</p><p>Kegiatan ini bertujuan untuk memperkenalkan warisan budaya bangsa sejak usia dini, sekaligus melatih kemampuan observasi dan rasa ingin tahu siswa.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '3 days'
    ),
    (
      'Workshop Robotik & Coding untuk Anak',
      'workshop-robotik-coding-anak',
      '<p>Program after-school Robotik & Coding kembali menggelar workshop perdana bulan ini. Siswa diajak merakit robot sederhana dan belajar dasar pemrograman visual menggunakan Scratch.</p><p>Pendaftaran masih dibuka untuk gelombang kedua. Hubungi tim akademik untuk informasi lebih lanjut.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '5 days'
    ),
    (
      'Lomba Mewarnai Tingkat TK se-Jakarta',
      'lomba-mewarnai-tk-se-jakarta',
      '<p>Tiga siswa TKA Kasih Paramitha berhasil meraih juara dalam Lomba Mewarnai Tingkat TK se-Jakarta. Selamat kepada Aira, Bima, dan Cinta atas prestasinya!</p><p>Prestasi ini menjadi bukti bahwa kreativitas dan kerja keras siswa sangat dihargai. Terima kasih juga kepada para guru dan orang tua yang terus mendampingi.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '7 days'
    ),
    (
      'Program Calistung: Membangun Fondasi Literasi Awal',
      'program-calistung-fondasi-literasi',
      '<p>Calistung (Baca, Tulis, Hitung) adalah salah satu program unggulan kami untuk membangun fondasi literasi sejak dini. Pendekatan kami menggabungkan permainan, lagu, dan aktivitas hands-on.</p><p>Setiap minggu, anak-anak diberi tantangan baru yang seru sekaligus mengasah kemampuan dasar mereka.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '10 days'
    ),
    (
      'Open House Kasih Paramitha School',
      'open-house-kasih-paramitha',
      '<p>Saksikan langsung suasana belajar dan fasilitas Kasih Paramitha School dalam acara Open House kami. Orang tua dapat berkonsultasi dengan tim akademik dan melihat berbagai kegiatan siswa.</p><p>Acara terbuka untuk umum. Refreshment & doorprize menarik tersedia.</p>',
      'published', 'article', NULL, uid, NOW() - INTERVAL '14 days'
    )
  ON CONFLICT (slug) DO NOTHING;

  -- ── 6 PENGUMUMAN PUBLIK ───────────────────────────────────
  INSERT INTO public.articles (title, slug, content, status, type, audience_category_id, user_id, created_at)
  VALUES
    (
      'Libur Hari Raya Waisak',
      'libur-waisak-2026',
      '<p>Diberitahukan kepada seluruh siswa dan orang tua bahwa pada hari <strong>Senin, 4 Mei 2026</strong>, sekolah diliburkan dalam rangka memperingati Hari Raya Waisak. Kegiatan belajar mengajar akan kembali normal pada hari Selasa.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '6 hours'
    ),
    (
      'Pembagian Rapor Tengah Semester',
      'pembagian-rapor-tengah-semester',
      '<p>Pembagian rapor tengah semester akan dilaksanakan pada <strong>Sabtu, 26 April 2026</strong> mulai pukul 08.00 WIB. Mohon kehadiran orang tua/wali untuk pengambilan rapor langsung di sekolah.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '1 day'
    ),
    (
      'Pendaftaran Siswa Baru Dibuka',
      'pendaftaran-siswa-baru-dibuka',
      '<p>Pendaftaran siswa baru tahun ajaran 2026/2027 telah resmi dibuka! Kuota terbatas. Informasi lengkap dapat menghubungi front office atau kunjungi website kami.</p><p>Jangan sampai ketinggalan, daftarkan putra-putri Anda sekarang juga.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '2 days'
    ),
    (
      'Pemeriksaan Kesehatan Berkala',
      'pemeriksaan-kesehatan-berkala',
      '<p>Tim kesehatan sekolah akan melakukan pemeriksaan kesehatan rutin (tinggi badan, berat badan, gigi) pada <strong>Rabu, 23 April 2026</strong>. Mohon siswa hadir dengan kondisi sehat.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '3 days'
    ),
    (
      'Rapat Orang Tua Murid',
      'rapat-orang-tua-murid-q2',
      '<p>Rapat rutin orang tua murid akan diadakan pada <strong>Jumat, 25 April 2026</strong> pukul 16.00 WIB di aula sekolah. Agenda: laporan akademik, rencana kegiatan akhir tahun, dan tanya jawab.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '4 days'
    ),
    (
      'Imbauan Protokol Kesehatan',
      'imbauan-protokol-kesehatan',
      '<p>Sehubungan dengan musim peralihan, kami mengimbau seluruh siswa untuk menjaga kesehatan: cukup istirahat, makan bergizi, rajin cuci tangan, dan menggunakan masker bila sedang flu/batuk.</p>',
      'published', 'announcement', NULL, uid, NOW() - INTERVAL '5 days'
    )
  ON CONFLICT (slug) DO NOTHING;

  -- ── PENGUMUMAN PER KATEGORI KELAS ─────────────────────────
  -- 1 pengumuman untuk masing-masing kategori (KG A, KG B, PG A, PG B,
  -- ROBOTICS / CODING, Calistung, English Mathematic, Sensoric).
  -- Hanya muncul untuk user yang category_id-nya sama.
  INSERT INTO public.articles (title, slug, content, status, type, audience_category_id, user_id, created_at)
  SELECT
    'Pengumuman Khusus Kelas ' || c.name,
    'pengumuman-kelas-' || regexp_replace(lower(c.name), '[^a-z0-9]+', '-', 'g'),
    '<p>Halo orang tua siswa kelas <strong>' || c.name || '</strong>. Berikut beberapa info penting minggu ini:</p>'
      || '<ul>'
      || '<li>Mohon membawa perlengkapan belajar lengkap setiap hari.</li>'
      || '<li>Akan ada kegiatan tematik mingguan — detail dibagikan oleh wali kelas.</li>'
      || '<li>Untuk pertanyaan, silakan hubungi wali kelas masing-masing.</li>'
      || '</ul>'
      || '<p>Terima kasih atas kerja samanya.</p>',
    'published',
    'announcement',
    c.id,
    uid,
    NOW() - make_interval(hours => c.id::int)
  FROM public.categories c
  ON CONFLICT (slug) DO NOTHING;

  RAISE NOTICE 'Seed selesai. user_id yang dipakai: %', uid;
END $$;
