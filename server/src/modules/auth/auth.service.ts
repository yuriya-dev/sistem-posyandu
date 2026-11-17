import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../../shared/config/prisma';
import { sendResetPasswordEmail } from '../../shared/config/email';


export const authService = {
  async register(data: { nama: string; email: string; password: string; posyanduId: string }) {
    const { nama, email, password, posyanduId } = data;

    const existing = await prisma.kader.findUnique({ where: { email } });
    if (existing) {
      const err = new Error('Email sudah terdaftar');
      (err as any).statusCode = 409;
      throw err;
    }

    const posyandu = await prisma.posyandu.findUnique({ where: { id: posyanduId } });
    if (!posyandu) {
      const err = new Error('Posyandu tidak ditemukan');
      (err as any).statusCode = 404;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const kaderCount = await prisma.kader.count({ where: { posyanduId } });
    const role = kaderCount === 0 ? 'OWNER' : 'KADER';

    return prisma.kader.create({
      data: { id: uuidv4(), nama, email, password: hashedPassword, posyanduId, role: role as 'OWNER' | 'KADER' },
      select: { id: true, nama: true, username: true, email: true, role: true, posyanduId: true },
    });
  },

  async registerPosyandu(data: {
    namaPosyandu: string;
    desa: string;
    kecamatan: string;
    alamat: string;
    namaKader: string;
    username?: string;
    email: string;
    password: string;
  }) {
    const { namaPosyandu, desa, kecamatan, alamat, namaKader, username, email, password } = data;

    if (!namaPosyandu || !desa || !kecamatan || !alamat || !namaKader || !email || !password) {
      const err = new Error('Semua field wajib diisi');
      (err as any).statusCode = 400;
      throw err;
    }

    if (username && username.trim()) {
      const existingUsername = await prisma.kader.findUnique({ where: { username: username.trim() } });
      if (existingUsername) {
        const err = new Error('Username sudah digunakan oleh akun lain');
        (err as any).statusCode = 409;
        throw err;
      }
    }

    if (password.length < 8) {
      const err = new Error('Password minimal 8 karakter');
      (err as any).statusCode = 400;
      throw err;
    }

    const existingKader = await prisma.kader.findUnique({ where: { email } });
    if (existingKader) {
      const err = new Error('Email sudah terdaftar');
      (err as any).statusCode = 409;
      throw err;
    }

    const existingPosyandu = await prisma.posyandu.findFirst({
      where: {
        nama: {
          equals: namaPosyandu.trim(),
          mode: 'insensitive',
        },
      },
    });
    if (existingPosyandu) {
      const err = new Error('Nama Posyandu sudah digunakan. Silakan gunakan nama lain');
      (err as any).statusCode = 409;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (tx) => {
      const posyandu = await tx.posyandu.create({
        data: { nama: namaPosyandu, desa, kecamatan, alamat },
      });

      const kader = await tx.kader.create({
        data: {
          id: uuidv4(),
          nama: namaKader,
          username: username?.trim() || null,
          email,
          password: hashedPassword,
          posyanduId: posyandu.id,
          role: 'OWNER',
        },
        select: { id: true, nama: true, username: true, email: true, role: true },
      });

      return { posyandu, kader };
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET tidak dikonfigurasi');

    const token = jwt.sign(
      { userId: result.kader.id, posyanduId: result.posyandu.id, role: 'OWNER', nama: result.kader.nama },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    return {
      token,
      kader: {
        ...result.kader,
        posyandu: { id: result.posyandu.id, nama: result.posyandu.nama },
      },
    };
  },

  async login(data: { emailOrUsername: string; password: string }) {
    const { emailOrUsername, password } = data;

    // Cari berdasarkan email atau username
    let kader = await prisma.kader.findFirst({
      where: {
        OR: [
          { email: emailOrUsername },
          { username: emailOrUsername },
        ],
      },
      include: { posyandu: { select: { id: true, nama: true } } },
    });

    if (!kader) {
      // Demo Puskesmas account support — hanya aktif jika DEMO_PUSKESMAS_PASSWORD dikonfigurasi di env
      const demoPuskesmasPassword = process.env.DEMO_PUSKESMAS_PASSWORD;
      const isDemoLogin =
        demoPuskesmasPassword &&
        (emailOrUsername.toLowerCase() === 'puskesmas' || emailOrUsername.toLowerCase() === 'puskesmas@gmail.com') &&
        password === demoPuskesmasPassword;
      if (isDemoLogin) {
        const secret = process.env.JWT_SECRET || 'fallback_secret_posyandu_siip';
        const token = jwt.sign(
          {
            userId: 'puskesmas-demo-id',
            posyanduId: 'puskesmas-wilayah-id',
            role: 'PUSKESMAS',
            nama: 'Petugas Puskesmas Wilayah',
          },
          secret,
          { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
        );
        return {
          token,
          kader: {
            id: 'puskesmas-demo-id',
            nama: 'Petugas Puskesmas Wilayah',
            username: 'puskesmas',
            email: 'puskesmas@gmail.com',
            role: 'PUSKESMAS' as any,
            posyandu: { id: 'puskesmas-wilayah-id', nama: 'Puskesmas Kecamatan' },
          },
        };
      }

      const err = new Error('Email/username atau password salah');
      (err as any).statusCode = 401;
      throw err;
    }

    if (!(await bcrypt.compare(password, kader.password))) {
      const err = new Error('Email/username atau password salah');
      (err as any).statusCode = 401;
      throw err;
    }

    if (!kader.isActive) {
      const err = new Error('Akun Anda telah dinonaktifkan');
      (err as any).statusCode = 403;
      throw err;
    }

    const isPuskesmasUser =
      (kader.role as string) === 'PUSKESMAS' ||
      kader.username?.toLowerCase() === 'puskesmas' ||
      kader.email.toLowerCase().startsWith('puskesmas') ||
      kader.posyandu.nama.toLowerCase().includes('puskesmas');

    const effectiveRole = isPuskesmasUser ? 'PUSKESMAS' : kader.role;

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET tidak dikonfigurasi');

    const token = jwt.sign(
      { userId: kader.id, posyanduId: kader.posyanduId, role: effectiveRole, nama: kader.nama },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    return {
      token,
      kader: {
        id: kader.id,
        nama: kader.nama,
        username: kader.username,
        email: kader.email,
        role: effectiveRole as any,
        posyandu: kader.posyandu,
      },
    };
  },

  async getMe(userId: string) {
    if (userId === 'puskesmas-demo-id') {
      return {
        id: 'puskesmas-demo-id',
        nama: 'Petugas Puskesmas Wilayah',
        username: 'puskesmas',
        email: 'puskesmas@gmail.com',
        role: 'PUSKESMAS' as any,
        isActive: true,
        posyandu: { id: 'puskesmas-wilayah-id', nama: 'Puskesmas Kecamatan', desa: 'Wilayah', kecamatan: 'Kecamatan' },
      };
    }

    const kader = await prisma.kader.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
        posyandu: { select: { id: true, nama: true, desa: true, kecamatan: true } },
      },
    });

    if (!kader) {
      const err = new Error('Pengguna tidak ditemukan');
      (err as any).statusCode = 404;
      throw err;
    }

    const isPuskesmasUser =
      (kader.role as string) === 'PUSKESMAS' ||
      kader.username?.toLowerCase() === 'puskesmas' ||
      kader.email.toLowerCase().startsWith('puskesmas') ||
      kader.posyandu.nama.toLowerCase().includes('puskesmas');

    const effectiveRole = isPuskesmasUser ? 'PUSKESMAS' : kader.role;

    return {
      ...kader,
      role: effectiveRole as any,
    };
  },

  async updateProfile(userId: string, data: { nama: string; email: string; username?: string; password?: string; oldPassword?: string }) {
    const { nama, email, username, password, oldPassword } = data;

    if (!nama || !email) {
      const err = new Error('Nama dan email wajib diisi');
      (err as any).statusCode = 400;
      throw err;
    }

    const currentUser = await prisma.kader.findUnique({ where: { id: userId } });
    if (!currentUser) {
      const err = new Error('Pengguna tidak ditemukan');
      (err as any).statusCode = 404;
      throw err;
    }

    const existing = await prisma.kader.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (existing) {
      const err = new Error('Email sudah digunakan oleh pengguna lain');
      (err as any).statusCode = 409;
      throw err;
    }

    // Validasi uniqueness username jika diisi
    if (username && username.trim()) {
      const existingUsername = await prisma.kader.findFirst({
        where: { username: username.trim(), NOT: { id: userId } },
      });
      if (existingUsername) {
        const err = new Error('Username sudah digunakan oleh pengguna lain');
        (err as any).statusCode = 409;
        throw err;
      }
    }

    const updateData: any = { nama, email };
    if (username !== undefined) {
      updateData.username = username.trim() || null;
    }

    // Jika pengguna ingin mengganti password
    if (password && password.trim().length > 0) {
      if (!oldPassword || !oldPassword.trim()) {
        const err = new Error('Password lama wajib diisi untuk mengganti kata sandi');
        (err as any).statusCode = 400;
        throw err;
      }
      const isOldPasswordValid = await bcrypt.compare(oldPassword.trim(), currentUser.password);
      if (!isOldPasswordValid) {
        const err = new Error('Password lama yang Anda masukkan tidak sesuai');
        (err as any).statusCode = 400;
        throw err;
      }
      if (password.trim().length < 6) {
        const err = new Error('Password baru minimal 6 karakter');
        (err as any).statusCode = 400;
        throw err;
      }
      updateData.password = await bcrypt.hash(password.trim(), 12);
    }

    return prisma.kader.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        nama: true,
        username: true,
        email: true,
        role: true,
        posyandu: { select: { id: true, nama: true } },
      },
    });
  },

  async forgotPassword(email: string) {
    const kader = await prisma.kader.findUnique({ where: { email } });
    if (!kader) {
      return { message: 'Jika email terdaftar, instruksi reset password telah dikirim ke email Anda. Silakan periksa Kotak Masuk (Inbox) atau folder Spam.' };
    }

    if (!kader.isActive) {
      const err = new Error('Akun Anda dinonaktifkan.');
      (err as any).statusCode = 403;
      throw err;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);

    await (prisma.kader as any).update({
      where: { id: kader.id },
      data: {
        resetPasswordToken,
        resetPasswordExpires,
      },
    });

    const clientHost = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : 'https://sistem-posyandu.vercel.app';
    const resetUrl = `${clientHost}/reset-password?token=${resetToken}`;

    await sendResetPasswordEmail({
      to: kader.email,
      nama: kader.nama,
      resetUrl,
    });

    return { message: 'Instruksi reset password telah dikirim ke email Anda. Silakan periksa Kotak Masuk (Inbox) atau folder Spam.' };
  },

  async verifyResetToken(token: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const kader = await (prisma.kader as any).findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!kader) {
      return { valid: false, message: 'Tautan reset password tidak valid atau telah kadaluarsa.' };
    }

    return { valid: true };
  },

  async resetPassword(token: string, newPassword: string) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const kader = await (prisma.kader as any).findFirst({
      where: {
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { gt: new Date() },
      },
    });

    if (!kader) {
      const err = new Error('Tautan reset password tidak valid atau telah kadaluarsa.');
      (err as any).statusCode = 400;
      throw err;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await (prisma.kader as any).update({
      where: { id: kader.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Kata sandi Anda berhasil diperbarui. Silakan masuk dengan kata sandi baru Anda.' };
  },

  async googleLogin(idToken: string) {
    if (!idToken) {
      const err = new Error('Token Google tidak ditemukan');
      (err as any).statusCode = 400;
      throw err;
    }

    let email: string | undefined;
    let name: string | undefined;

    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    try {
      if (googleClientId) {
        const client = new OAuth2Client(googleClientId);
        const ticket = await client.verifyIdToken({
          idToken,
          audience: googleClientId,
        });
        const payload = ticket.getPayload();
        email = payload?.email;
        name = payload?.name;
      } else {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (!response.ok) {
          const err = new Error('Token Google tidak valid atau telah kadaluarsa');
          (err as any).statusCode = 401;
          throw err;
        }
        const payload: any = await response.json();
        email = payload.email;
        name = payload.name;
      }
    } catch (err: any) {
      if (err.statusCode) throw err;
      try {
        const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
        if (response.ok) {
          const payload: any = await response.json();
          email = payload.email;
          name = payload.name;
        } else {
          const verifyErr = new Error('Verifikasi token Google gagal: ' + (err.message || 'Token tidak valid'));
          (verifyErr as any).statusCode = 401;
          throw verifyErr;
        }
      } catch (fallbackErr: any) {
        if (fallbackErr.statusCode) throw fallbackErr;
        const finalErr = new Error('Verifikasi token Google gagal');
        (finalErr as any).statusCode = 401;
        throw finalErr;
      }
    }

    if (!email) {
      const err = new Error('Email tidak ditemukan dari kredensial Google');
      (err as any).statusCode = 400;
      throw err;
    }

    const kader = await prisma.kader.findUnique({
      where: { email: email.toLowerCase() },
      include: { posyandu: { select: { id: true, nama: true } } },
    });

    if (!kader) {
      const err = new Error(`Email Google Anda (${email}) belum terdaftar sebagai Kader. Silakan hubungi Owner Posyandu untuk mendaftarkan email Anda.`);
      (err as any).statusCode = 404;
      throw err;
    }

    if (!kader.isActive) {
      const err = new Error('Akun Anda telah dinonaktifkan.');
      (err as any).statusCode = 403;
      throw err;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET tidak dikonfigurasi');

    const token = jwt.sign(
      { userId: kader.id, posyanduId: kader.posyanduId, role: kader.role, nama: kader.nama },
      secret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
    );

    try {
      await prisma.auditLog.create({
        data: {
          posyanduId: kader.posyanduId,
          kaderId: kader.id,
          kaderNama: kader.nama,
          action: 'LOGIN_GOOGLE',
          details: `Kader ${kader.nama} berhasil masuk via Google (${email})`,
        },
      });
    } catch {
      // ignore
    }

    return {
      token,
      kader: {
        id: kader.id,
        nama: kader.nama,
        username: kader.username,
        email: kader.email,
        role: kader.role,
        posyandu: kader.posyandu,
      },
    };
  },
};

