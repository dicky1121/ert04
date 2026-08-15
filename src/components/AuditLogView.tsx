import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  Trash2, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  User, 
  Activity,
  Calendar,
  FileSpreadsheet
} from 'lucide-react';
import { AuditLog, CurrentUser } from '../types';
import { storageService } from '../services/storage';
import { useConfirm } from './ConfirmDialog';
import * as XLSX from 'xlsx';

interface AuditLogViewProps {
  currentUser: CurrentUser;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentUser }) => {
  const [logs, setLogs] = useState<AuditLog[]>(storageService.getAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'SUKSES' | 'PERINGATAN' | 'GAGAL'>('ALL');

  const filteredLogs = logs.filter(log => {
    const matchSearch = 
      log.aktivitas.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.adminNama.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.target.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.detail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = selectedStatus === 'ALL' || log.status === selectedStatus;

    return matchSearch && matchStatus;
  });

  // Dialog konfirmasi bergaya aplikasi (pengganti window.confirm)
  const { confirm: askConfirm, dialog } = useConfirm();

  const handleClearLogs = async () => {
    const setuju = await askConfirm({
      title: 'Kosongkan Riwayat Aktivitas',
      message:
        'Seluruh catatan riwayat aktivitas admin akan dihapus permanen dan tidak dapat dipulihkan. Lanjutkan?',
      confirmLabel: 'Ya, Kosongkan Riwayat',
      tone: 'danger'
    });
    if (!setuju) return;

    storageService.clearAuditLogs();
    setLogs([]);
  };

  const handleExportLogs = () => {
    const wb = XLSX.utils.book_new();
    const rows = logs.map((l, i) => ({
      No: i + 1,
      Timestamp: l.timestamp,
      'Nama Admin': l.adminNama,
      'Peran (Role)': l.adminRole,
      Aktivitas: l.aktivitas,
      'Target / NIK / No Surat': l.target,
      'Rincian Detail': l.detail,
      Status: l.status
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Log Aktivitas Admin RT');
    XLSX.writeFile(wb, `Audit_Logs_RT004_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Dialog konfirmasi/notifikasi terpusat */}
      {dialog}


      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            Audit Trail & Log Aktivitas Admin RT
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan riwayat setiap penambahan, modifikasi data warga, penerbitan surat, dan sinkronisasi sistem
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportLogs}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-full border border-slate-200 shadow-xs transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Ekspor Log (.xlsx)
          </button>
          <button
            onClick={handleClearLogs}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-full border border-rose-200 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Bersihkan Log
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-[11px]">Total Aktivitas Tercatat</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{logs.length}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Seluruh sesi admin</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-emerald-700 text-[11px] font-semibold">Operasi Sukses</div>
          <div className="text-xl font-bold text-emerald-800 mt-1">
            {logs.filter(l => l.status === 'SUKSES').length}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Tervalidasi sempurna</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-amber-700 text-[11px] font-semibold">Peringatan / Warning</div>
          <div className="text-xl font-bold text-amber-800 mt-1">
            {logs.filter(l => l.status === 'PERINGATAN').length}
          </div>
          <div className="text-[10px] text-amber-600 mt-0.5">Perlu perhatian</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-blue-700 text-[11px] font-semibold">Admin Aktif Saat Ini</div>
          <div className="text-sm font-bold text-slate-900 mt-1 truncate">{currentUser.nama}</div>
          <div className="text-[10px] text-blue-600 mt-0.5">{currentUser.role}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari berdasarkan aktivitas, nama admin, target NIK/Nomor Surat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
          <button
            onClick={() => setSelectedStatus('ALL')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
              selectedStatus === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setSelectedStatus('SUKSES')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
              selectedStatus === 'SUKSES' ? 'bg-emerald-700 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Sukses
          </button>
          <button
            onClick={() => setSelectedStatus('PERINGATAN')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
              selectedStatus === 'PERINGATAN' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Peringatan
          </button>
          <button
            onClick={() => setSelectedStatus('GAGAL')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition ${
              selectedStatus === 'GAGAL' ? 'bg-rose-700 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Gagal
          </button>
        </div>
      </div>

      {/* Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="table-scroll table-head-slate-100">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="p-3.5 w-44">Waktu (Timestamp)</th>

                <th className="p-3.5 w-48">Petugas / Admin</th>
                <th className="p-3.5 w-48">Aktivitas</th>
                <th className="p-3.5 w-40">Target Objek</th>
                <th className="p-3.5">Detail & Keterangan</th>
                <th className="p-3.5 w-24 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.timestamp}</span>
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-900">{log.adminNama}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.adminRole}</div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {log.aktivitas}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-700 text-[11px]">
                      {log.target}
                    </td>
                    <td className="p-3.5 text-slate-600 leading-relaxed">
                      {log.detail}
                    </td>
                    <td className="p-3.5 text-center">
                      {log.status === 'SUKSES' && (
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px] border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Berhasil
                        </span>
                      )}
                      {log.status === 'PERINGATAN' && (
                        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 font-bold rounded-full text-[10px] border border-amber-200 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Warning
                        </span>
                      )}
                      {log.status === 'GAGAL' && (
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 font-bold rounded-full text-[10px] border border-rose-200 inline-flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Gagal
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 text-xs">
                    Tidak ada catatan aktivitas yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
