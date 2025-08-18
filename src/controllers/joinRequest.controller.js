import { createJoinRequest, getMeetupRequests, respondToRequest } from "../services/joinRequest.service.js";

export const sendJoinRequest = async (req, res) => {
  try {
    const { meetupId } = req.params;
    const request = await createJoinRequest(
      meetupId,
      req.user.id
    );
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const listMeetupRequests = async (req, res) => {
  try {
    const { meetupId } = req.params;
    const requests = await getMeetupRequests(
      meetupId,
      req.user.id
    );
    res.json(requests);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const respondToJoinRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "accept" | "reject"
    const request = await respondToRequest(
      id,
      req.user.id,
      action
    );
    res.json(request);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
