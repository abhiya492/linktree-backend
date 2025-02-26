const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateReferralCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 8; i++) {
      code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    const existing = await prisma.user.findUnique({ where: { referral_code: code } });
    isUnique = !existing;
  }
  return code;
}

module.exports = generateReferralCode;