import { sendPasswordResetEmail } from 'firebase/auth';

import { sendPasswordReset } from '../auth';

jest.mock('firebase/auth', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

jest.mock('../firebase', () => ({
  getFirebaseAuth: () => ({ languageCode: 'es' }),
}));

const mockedSendPasswordResetEmail = sendPasswordResetEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('sendPasswordReset', () => {
  it('pide a Firebase el correo de restablecimiento', async () => {
    mockedSendPasswordResetEmail.mockResolvedValue(undefined);

    await sendPasswordReset('ana@epmaps.com.ec');

    expect(mockedSendPasswordResetEmail).toHaveBeenCalledWith(
      { languageCode: 'es' },
      'ana@epmaps.com.ec',
    );
  });

  it('no revela que el correo no tiene una cuenta', async () => {
    mockedSendPasswordResetEmail.mockRejectedValue({ code: 'auth/user-not-found' });

    await expect(sendPasswordReset('nadie@epmaps.com.ec')).resolves.toBeUndefined();
  });

  it('informa los errores de conexión', async () => {
    mockedSendPasswordResetEmail.mockRejectedValue({ code: 'auth/network-request-failed' });

    await expect(sendPasswordReset('ana@epmaps.com.ec')).rejects.toMatchObject({
      reason: 'network',
    });
  });
});
