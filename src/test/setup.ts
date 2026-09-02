// Setup global untuk Vitest — dijalankan sebelum setiap file test.
// Menambahkan matcher DOM (`toBeInTheDocument`, dst.) untuk test komponen
// yang memakai @testing-library/react. Test unit murni (utils) tidak
// memerlukan ini, tapi mengimpornya di sini aman untuk keduanya.
import '@testing-library/jest-dom/vitest';
