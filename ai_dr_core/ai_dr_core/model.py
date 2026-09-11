import os
import torch
import numpy as np

# ==============================================================================
# PyTorch Neural Network for Dynamic Measurement Covariance Estimation
# Reused & adapted directly from ai-imu-dr (utils_torch_filter.py: MesNet)
# ==============================================================================

class MesNet(torch.nn.Module):
    """
    1D Dilated Convolutional Neural Network from ai-imu-dr.
    Input: 6-channel IMU sequence (wx, wy, wz, ax, ay, az).
    Output: 2D dynamic measurement covariance multiplier for Non-Holonomic Constraints
            (zero lateral velocity, zero vertical velocity).
    """
    def __init__(self):
        super(MesNet, self).__init__()
        self.beta_measurement = 3.0 * torch.ones(2, dtype=torch.float64)
        self.tanh = torch.nn.Tanh()

        self.cov_net = torch.nn.Sequential(
            torch.nn.Conv1d(6, 32, kernel_size=5),
            torch.nn.ReplicationPad1d(4),
            torch.nn.ReLU(),
            torch.nn.Dropout(p=0.5),
            torch.nn.Conv1d(32, 32, kernel_size=5, dilation=3),
            torch.nn.ReplicationPad1d(4),
            torch.nn.ReLU(),
            torch.nn.Dropout(p=0.5),
        ).double()

        self.cov_lin = torch.nn.Sequential(
            torch.nn.Linear(32, 2),
            torch.nn.Tanh(),
        ).double()

        self.cov_lin[0].bias.data[:] /= 100.0
        self.cov_lin[0].weight.data[:] /= 100.0

    def forward(self, u_tensor, cov0_measurement):
        """
        u_tensor: shape (1, 6, N) - 6-channel normalized IMU measurements over time
        cov0_measurement: shape (2,) or (1, 2) base covariance [cov_lat, cov_up]
        Returns: dynamic measurement covariance of shape (N, 2)
        """
        y_cov = self.cov_net(u_tensor).transpose(1, 2).squeeze(0)  # (N, 32)
        z_cov = self.cov_lin(y_cov)  # (N, 2)
        z_cov_net = self.beta_measurement.unsqueeze(0) * z_cov
        measurements_covs = cov0_measurement.unsqueeze(0) * (10.0 ** z_cov_net)
        return measurements_covs


class AICovarianceAdapter:
    """
    Streaming AI covariance adapter for online real-time inference.
    Maintains a sliding temporal window of normalized IMU readings and computes
    instantaneous measurement noise covariance R = diag(cov_lat, cov_up).
    """
    def __init__(self,
                 weights_path=None,
                 window_size=20,
                 base_cov=(1.0, 10.0),
                 u_loc=None,
                 u_std=None):
        self.window_size = window_size
        self.base_cov_tensor = torch.tensor(base_cov, dtype=torch.float64)
        self.model = MesNet().eval()
        self.weights_loaded = False

        # Default normalizations (approximate statistics of normalized driving data)
        # [gyro_x, gyro_y, gyro_z, acc_x, acc_y, acc_z]
        self.u_loc = torch.tensor(u_loc if u_loc is not None else [0.0, 0.0, 0.0, 0.0, 0.0, 9.80665], dtype=torch.float64)
        self.u_std = torch.tensor(u_std if u_std is not None else [0.2, 0.2, 0.2, 1.5, 1.5, 2.0], dtype=torch.float64)

        # Sliding window buffer
        self.buffer = []

        if weights_path and os.path.isfile(weights_path):
            try:
                state_dict = torch.load(weights_path, map_location="cpu")
                if "mes_net" in state_dict:
                    # Filter for mes_net keys if full iekf dictionary
                    sub_dict = {k.replace("mes_net.", ""): v for k, v in state_dict.items() if k.startswith("mes_net.")}
                    self.model.load_state_dict(sub_dict if sub_dict else state_dict, strict=False)
                else:
                    self.model.load_state_dict(state_dict, strict=False)
                self.weights_loaded = True
            except Exception as e:
                print(f"[AICovarianceAdapter] Could not load weights from {weights_path}: {e}")

    def update_sample(self, imu_6d: np.ndarray) -> np.ndarray:
        """
        Add one IMU sample (gyro 3D, acc 3D) and return the predicted [cov_lat, cov_up].
        imu_6d: shape (6,) array [wx, wy, wz, ax, ay, az]
        """
        self.buffer.append(imu_6d)
        if len(self.buffer) > self.window_size:
            self.buffer.pop(0)

        # Pad window if buffer not yet full
        window = np.array(self.buffer, dtype=np.float64)
        if len(window) < self.window_size:
            pad = np.tile(window[0], (self.window_size - len(window), 1))
            window = np.vstack([pad, window])

        u_tensor = torch.from_numpy(window).double()  # (W, 6)
        u_norm = (u_tensor - self.u_loc) / self.u_std
        u_in = u_norm.t().unsqueeze(0)  # (1, 6, W)

        with torch.no_grad():
            covs = self.model(u_in, self.base_cov_tensor)  # (W, 2)
            current_cov = covs[-1].cpu().numpy()

        return current_cov
