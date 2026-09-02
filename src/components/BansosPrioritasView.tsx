import React, { useState, useMemo } from 'react';
import { 
  HeartHandshake, 
  Search, 
  FileSpreadsheet
} from 'lucide-react';
import { Warga, RTConfig } from '../types';
import { calculateDemographics } from '../services/storage';
import { useModalDismiss } from '../hooks/useModalDismiss';

interface BansosPrioritasViewProps {
  wargaList: Warga[];
  config: RTConfig;
  onUpdateBansosStatus: (wargaId: string, statusBansos: any, keterangan?: string) => void;
  onExportExcel: () => void;
}

export const BansosPrioritasView: React.FC<BansosPrioritasViewProps> = ({
  wargaList,
  config,
  onUpdateBansosStatus,
  onExportExcel
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'ALL_BANSOS' | 'PKH' | 'BPNT' | 'BLT' | 'LANSIA' | 'BALITA' | 'YATIM'>('ALL_BANSOS');
  
  // Selected warga for quick bansos update
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [targetWarga, setTargetWarga] = useState<Warga | null>(null);
  const [newBansosStatus, setNewBansosStatus] = useState('PKH');
  const [newKeterangan, setNewKeterangan] = useState('');

  // Escape, focus trap, dan pemulihan fokus untuk modal ubah status bansos.
  const editDialogRef = useModalDismiss<HTMLDivElement>(() => setIsEditModalOpen(false), isEditModalOpen);

  // Statistics
  const stats = useMemo(() => {
    let pkh = 0;
    let bpnt = 0;
    let blt = 0;
    let lansia = 0;
    let balita = 0;
    let yatim = 0;

    wargaList.forEach(w => {
      const demo = calculateDemographics(w.tanggalLahir);
      if (w.statusBansos === 'PKH') pkh++;
      if (w.statusBansos === 'BPNT') bpnt++;
      if (w.statusBansos === 'BLT') blt++;
      if (demo.isLansia || Boolean(w.isLansia)) lansia++;
      if (demo.isBalita || Boolean(w.isBalita)) balita++;
      if (w.isYatim) yatim++;
    });

    const totalBansos = wargaList.filter(w => w.statusBansos !== 'TIDAK_ADA').length;

    return { pkh, bpnt, blt, lansia, balita, yatim, totalBansos };
  }, [wargaList]);

  // Filtered List
  const filteredList = useMemo(() => {
    return wargaList.filter(w => {
      const demo = calculateDemographics(w.tanggalLahir);

      const matchQuery =
        w.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.nik.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.nomorKK.toLowerCase().includes(searchTerm.toLowerCase());

      let matchTab = true;
      if (selectedTab === 'ALL_BANSOS') {
        matchTab = w.statusBansos !== 'TIDAK_ADA';
      } else if (selectedTab === 'PKH') {
        matchTab = w.statusBansos === 'PKH';
      } else if (selectedTab === 'BPNT') {
        matchTab = w.statusBansos === 'BPNT';
      } else if (selectedTab === 'BLT') {
        matchTab = w.statusBansos === 'BLT';
      } else if (selectedTab === 'LANSIA') {
        matchTab = demo.isLansia || Boolean(w.isLansia);
      } else if (selectedTab === 'BALITA') {
        matchTab = demo.isBalita || Boolean(w.isBalita);
      } else if (selectedTab === 'YATIM') {
        matchTab = !!w.isYatim;
      }

      return matchQuery && matchTab;
    });
  }, [wargaList, searchTerm, selectedTab]);

  const handleOpenEdit = (w: Warga) => {
    setTargetWarga(w);
    setNewBansosStatus(w.statusBansos !== 'TIDAK_ADA' ? w.statusBansos : 'PKH');
    setNewKeterangan(w.keteranganBansos || '');
    setIsEditModalOpen(true);
  };

  const handleSaveBansos = (e: React.FormEvent) => {
    e.preventDefault();
    if (targetWarga) {
      onUpdateBansosStatus(targetWarga.id, newBansosStatus, newKeterangan);
      setIsEditModalOpen(false);
      setTargetWarga(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-emerald-600" />
            Distribusi Bantuan Sosial & Kelompok Prioritas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat data sasaran bantuan sosial, posyandu lansia, gizi balita, dan santunan yatim RT {config.namaRT} RW {config.namaRW}
          </p>
        </div>

        <button
          onClick={onExportExcel}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow transition cursor-pointer"
        >
          <FileSpreadsheet className="w-4 h-4" />
          Ekspor Daftar Penerima Bansos (Excel)
        </button>
      </div>

      {/* Program Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div 
          onClick={() => setSelectedTab('ALL_BANSOS')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'ALL_BANSOS' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">Total Penerima</div>
          <div className="text-xl font-extrabold mt-1">{stats.totalBansos} <span className="text-xs font-normal">Jiwa</span></div>
        </div>

        <div 
          onClick={() => setSelectedTab('PKH')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'PKH' ? 'bg-emerald-800 text-white border-emerald-800' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">Program PKH</div>
          <div className="text-xl font-extrabold mt-1 text-emerald-600">{stats.pkh} <span className="text-xs font-normal">KK</span></div>
        </div>

        <div 
          onClick={() => setSelectedTab('BPNT')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'BPNT' ? 'bg-blue-800 text-white border-blue-800' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">BPNT / Sembako</div>
          <div className="text-xl font-extrabold mt-1 text-blue-600">{stats.bpnt} <span className="text-xs font-normal">Jiwa</span></div>
        </div>

        <div 
          onClick={() => setSelectedTab('LANSIA')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'LANSIA' ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">👵 Lansia (60+)</div>
          <div className="text-xl font-extrabold mt-1 text-amber-600">{stats.lansia} <span className="text-xs font-normal">Jiwa</span></div>
        </div>

        <div 
          onClick={() => setSelectedTab('BALITA')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'BALITA' ? 'bg-purple-700 text-white border-purple-700' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">👶 Balita (0-5)</div>
          <div className="text-xl font-extrabold mt-1 text-purple-600">{stats.balita} <span className="text-xs font-normal">Anak</span></div>
        </div>

        <div 
          onClick={() => setSelectedTab('YATIM')}
          className={`p-3.5 rounded-xl border transition cursor-pointer ${
            selectedTab === 'YATIM' ? 'bg-teal-700 text-white border-teal-700' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-xs font-semibold opacity-80 uppercase">🤲 Anak Yatim</div>
          <div className="text-xl font-extrabold mt-1 text-teal-600">{stats.yatim} <span className="text-xs font-normal">Anak</span></div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          placeholder="Cari Penerima berdasarkan Nama, NIK 16 digit, atau Nomor Kartu Keluarga..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
        />
      </div>

      {/* Data prioritas bansos — tabel (tampil ≥ md) */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="table-scroll">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Nama & NIK</th>
                <th className="px-4 py-3.5">Nomor Kartu Keluarga</th>
                <th className="px-4 py-3.5">Usia & Status</th>
                <th className="px-4 py-3.5 text-center">Status Bantuan Sosial</th>
                <th className="px-4 py-3.5">Keterangan / Alokasi</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
                    <p className="font-semibold text-slate-600">Tidak ada data warga di kategori ini</p>
                    <p className="text-xs text-slate-500 mt-0.5">Pilih tab lain atau periksa data warga.</p>
                  </td>
                </tr>
              ) : (
                filteredList.map((w) => {
                  const demo = calculateDemographics(w.tanggalLahir);
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 text-sm">{w.nama}</div>
                        <div className="font-mono text-slate-500 text-xs">
                          NIK: {w.nik}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono text-emerald-800 font-semibold">{w.nomorKK}</div>
                        <div className="text-xs text-slate-500">{w.statusHubunganKK}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800">{demo.usia} Tahun ({w.jenisKelamin === 'L' ? 'L' : 'P'})</div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {(demo.isLansia || Boolean(w.isLansia)) && <span className="text-xs px-1.5 bg-amber-100 text-amber-800 rounded font-semibold">Lansia ≥60</span>}
                          {(demo.isBalita || Boolean(w.isBalita)) && <span className="text-xs px-1.5 bg-purple-100 text-purple-800 rounded font-semibold">Balita ≤5</span>}
                          {w.isYatim && <span className="text-xs px-1.5 bg-teal-100 text-teal-800 rounded font-semibold">Yatim</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                          w.statusBansos === 'PKH'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : w.statusBansos === 'BPNT'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : w.statusBansos === 'BLT'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {w.statusBansos !== 'TIDAK_ADA' ? w.statusBansos : 'Bukan Penerima'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-600">
                        {w.keteranganBansos || (w.statusBansos !== 'TIDAK_ADA' ? 'Tercatat dalam DTKS Kemensos' : '-')}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => handleOpenEdit(w)}
                          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition border border-emerald-200"
                        >
                          Ubah Status Bansos
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data prioritas bansos — kartu (mobile, tampil < md) */}
      <div className="md:hidden space-y-3">
        {filteredList.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs text-center py-10 px-4">
            <HeartHandshake className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
            <p className="font-semibold text-slate-600">Tidak ada data warga di kategori ini</p>
            <p className="text-xs text-slate-500 mt-0.5">Pilih tab lain atau periksa data warga.</p>
          </div>
        ) : (
          filteredList.map((w) => {
            const demo = calculateDemographics(w.tanggalLahir);
            return (
              <article key={w.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header kartu */}
                <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{w.nama}</div>
                    <div className="font-mono text-slate-500 text-xs truncate">NIK: {w.nik}</div>
                  </div>
                  <span className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    w.statusBansos === 'PKH'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : w.statusBansos === 'BPNT'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : w.statusBansos === 'BLT'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {w.statusBansos !== 'TIDAK_ADA' ? w.statusBansos : 'Bukan Penerima'}
                  </span>
                </div>

                {/* Isi kartu */}
                <div className="px-4 py-3 space-y-1.5 text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">No. KK</span>
                    <span className="font-mono text-emerald-800 font-semibold text-right">{w.nomorKK}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Hubungan</span>
                    <span className="text-slate-700 text-right">{w.statusHubunganKK}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Usia</span>
                    <span className="font-semibold text-slate-800 text-right">{demo.usia} Tahun ({w.jenisKelamin === 'L' ? 'L' : 'P'})</span>
                  </div>
                  {((demo.isLansia || Boolean(w.isLansia)) || (demo.isBalita || Boolean(w.isBalita)) || w.isYatim) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {(demo.isLansia || Boolean(w.isLansia)) && <span className="text-xs px-1.5 bg-amber-100 text-amber-800 rounded font-semibold">Lansia ≥60</span>}
                      {(demo.isBalita || Boolean(w.isBalita)) && <span className="text-xs px-1.5 bg-purple-100 text-purple-800 rounded font-semibold">Balita ≤5</span>}
                      {w.isYatim && <span className="text-xs px-1.5 bg-teal-100 text-teal-800 rounded font-semibold">Yatim</span>}
                    </div>
                  )}
                  <div className="text-slate-600 pt-0.5">{w.keteranganBansos || (w.statusBansos !== 'TIDAK_ADA' ? 'Tercatat dalam DTKS Kemensos' : '-')}</div>
                </div>

                {/* Aksi kartu */}
                <div className="px-4 py-3 border-t border-slate-100">
                  <button
                    onClick={() => handleOpenEdit(w)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg text-xs transition border border-emerald-200 cursor-pointer"
                  >
                    Ubah Status Bansos
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* EDIT BANSOS MODAL */}
      {isEditModalOpen && targetWarga && (
        <div
      ref={editDialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="font-bold text-base text-slate-900">Perbarui Status Bantuan Sosial</h3>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-800">{targetWarga.nama}</div>
              <div className="text-slate-500 font-mono">NIK: {targetWarga.nik}</div>
            </div>

            <form onSubmit={handleSaveBansos} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Program Bansos</label>
                <select
                  value={newBansosStatus}
                  onChange={(e) => setNewBansosStatus(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs bg-white"
                >
                  <option value="TIDAK_ADA">Tidak Ada (Non-Penerima / Mampu)</option>
                  <option value="PKH">Program Keluarga Harapan (PKH)</option>
                  <option value="BPNT">Bantuan Pangan Non Tunai (BPNT / Sembako)</option>
                  <option value="BLT">Bantuan Langsung Tunai (BLT)</option>
                  <option value="BST">Bantuan Sosial Tunai (BST)</option>
                  <option value="BANSOS_DAERAH">Bansos APBD Kab. Bekasi</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Keterangan / Nomor Rekening Bansos</label>
                <input
                  type="text"
                  placeholder="Contoh: KKS Bank Mandiri / Penyaluran Kantor Pos"
                  value={newKeterangan}
                  onChange={(e) => setNewKeterangan(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                >
                  Simpan Status Bansos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
