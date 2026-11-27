import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../test/render';
import { degradedResponse, healthyResponse, jsonResponse } from '../test/fixtures';
import { HealthCard } from './HealthCard';

describe('HealthCard', () => {
  it('shows a checking state while the request is in flight', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => undefined));

    renderWithQueryClient(<HealthCard />);

    expect(screen.getAllByText('Checking…').length).toBeGreaterThan(0);
  });

  it('shows the API and database as up when healthy', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(healthyResponse));

    renderWithQueryClient(<HealthCard />);

    expect(await screen.findByText('All systems operational')).toBeInTheDocument();
    expect(screen.getByText('Up · 3 ms')).toBeInTheDocument();
    expect(screen.getByText('2m 5s')).toBeInTheDocument();
  });

  it('shows the database error when degraded', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(degradedResponse, 503));

    renderWithQueryClient(<HealthCard />);

    expect(await screen.findByTestId('overall-status')).toHaveTextContent('Degraded');
    expect(screen.getByText('Down')).toBeInTheDocument();
    expect(screen.getByText('connect ECONNREFUSED 127.0.0.1:5432')).toBeInTheDocument();
  });

  it('shows the API as unreachable when the request fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    renderWithQueryClient(<HealthCard />);

    expect(await screen.findByText('Unreachable')).toBeInTheDocument();
  });

  it('checks again when the button is clicked', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(degradedResponse, 503))
      .mockResolvedValueOnce(jsonResponse(healthyResponse));

    renderWithQueryClient(<HealthCard />);
    expect(await screen.findByTestId('overall-status')).toHaveTextContent('Degraded');

    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByText('All systems operational')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
