jest.setTimeout(60 * 10 * 1000);
process.env.VULTR_API_KEY = 'DNBT4GNZGW4WPQPY4NARSFLCY6PFIL4E5CDQ';
import VultrDeployment from '../src/index';

describe('', () => {
  it('deployment', async () => {
    const dep1 = new VultrDeployment();
    await dep1.deploy();
    expect(await dep1.healthCheck()).toBe(true);
    await dep1.destroy();
    expect(await dep1.healthCheck()).toBe(false);
  });
});
