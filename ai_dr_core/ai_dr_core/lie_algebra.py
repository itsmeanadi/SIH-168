import numpy as np

# ==============================================================================
# Lie Group & Lie Algebra Operations for Invariant EKF on SE_2(3)
# Reused & adapted directly from ai-imu-dr (utils_numpy_filter.py)
# ==============================================================================

Id3 = np.eye(3)
Id6 = np.eye(6)
IdP = np.eye(21)


def skew(x):
    """Compute the 3x3 skew-symmetric matrix of a 3D vector."""
    return np.array([
        [0.0, -x[2], x[1]],
        [x[2], 0.0, -x[0]],
        [-x[1], x[0], 0.0]
    ], dtype=np.float64)


def so3exp(phi):
    """
    Compute the SO(3) exponential map: R = exp(skew(phi))
    Uses Rodrigues formula with 1st-order Taylor expansion near 0.
    """
    angle = np.linalg.norm(phi)
    if np.abs(angle) < 1e-8:
        skew_phi = skew(phi)
        return Id3 + skew_phi

    axis = phi / angle
    skew_axis = skew(axis)
    s = np.sin(angle)
    c = np.cos(angle)
    return c * Id3 + (1.0 - c) * np.outer(axis, axis) + s * skew_axis


def so3left_jacobian(phi):
    """Compute the left Jacobian of SO(3)."""
    angle = np.linalg.norm(phi)
    if np.abs(angle) < 1e-8:
        skew_phi = skew(phi)
        return Id3 + 0.5 * skew_phi

    axis = phi / angle
    skew_axis = skew(axis)
    s = np.sin(angle)
    c = np.cos(angle)
    return (s / angle) * Id3 + (1.0 - s / angle) * np.outer(axis, axis) + ((1.0 - c) / angle) * skew_axis


def sen3exp(xi):
    """
    Exponential map for SE_2(3) group (orientation, velocity, position).
    xi: 9D vector [phi (3), v (3), p (3)]
    Returns:
        Rot: 3x3 rotation matrix
        x: 3x2 matrix where x[:, 0] is dv, x[:, 1] is dp
    """
    phi = xi[:3]
    angle = np.linalg.norm(phi)

    if np.abs(angle) < 1e-8:
        skew_phi = skew(phi)
        J = Id3 + 0.5 * skew_phi
        Rot = Id3 + skew_phi
    else:
        axis = phi / angle
        skew_axis = skew(axis)
        s = np.sin(angle)
        c = np.cos(angle)
        J = (s / angle) * Id3 + (1.0 - s / angle) * np.outer(axis, axis) + ((1.0 - c) / angle) * skew_axis
        Rot = c * Id3 + (1.0 - c) * np.outer(axis, axis) + s * skew_axis

    x = J.dot(xi[3:].reshape(-1, 3).T)
    return Rot, x


def normalize_rot(Rot):
    """Project 3x3 matrix back to SO(3) via SVD to eliminate numerical drift."""
    U, _, V = np.linalg.svd(Rot, full_matrices=False)
    S = np.eye(3)
    S[2, 2] = np.linalg.det(U) * np.linalg.det(V)
    return U.dot(S).dot(V)


def rotx(t):
    c = np.cos(t)
    s = np.sin(t)
    return np.array([[1.0, 0.0, 0.0],
                     [0.0, c, -s],
                     [0.0, s, c]], dtype=np.float64)


def roty(t):
    c = np.cos(t)
    s = np.sin(t)
    return np.array([[c, 0.0, s],
                     [0.0, 1.0, 0.0],
                     [-s, 0.0, c]], dtype=np.float64)


def rotz(t):
    c = np.cos(t)
    s = np.sin(t)
    return np.array([[c, -s, 0.0],
                     [s, c, 0.0],
                     [0.0, 0.0, 1.0]], dtype=np.float64)


def from_rpy(roll, pitch, yaw):
    """Compute rotation matrix from Roll, Pitch, Yaw (in radians)."""
    return rotz(yaw).dot(roty(pitch).dot(rotx(roll)))


def to_rpy(Rot):
    """Convert 3x3 rotation matrix to Roll, Pitch, Yaw (in radians)."""
    pitch = np.arctan2(-Rot[2, 0], np.sqrt(Rot[0, 0]**2 + Rot[1, 0]**2))
    if np.isclose(pitch, np.pi / 2.0):
        yaw = 0.0
        roll = np.arctan2(Rot[0, 1], Rot[1, 1])
    elif np.isclose(pitch, -np.pi / 2.0):
        yaw = 0.0
        roll = -np.arctan2(Rot[0, 1], Rot[1, 1])
    else:
        sec_pitch = 1.0 / np.cos(pitch)
        yaw = np.arctan2(Rot[1, 0] * sec_pitch, Rot[0, 0] * sec_pitch)
        roll = np.arctan2(Rot[2, 1] * sec_pitch, Rot[2, 2] * sec_pitch)
    return float(roll), float(pitch), float(yaw)
