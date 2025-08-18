import { 
  verifyPaymentAndCreateMeetup,
  getUserMeetups,
  fetchMeetupDetails,
  fetchMeetupHistory,
  updateMeetup,
  deleteMeetup
} from "../services/meetup.service.js";

export const createMeetupController = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { meetupData, paymentDetails } = req.body;
    
    const meetup = await verifyPaymentAndCreateMeetup(userId, meetupData, paymentDetails);
    res.status(201).json({ success: true, data: meetup });
  } catch (err) {
    next(err);
  }
};

export const getMyMeetupsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const meetups = await getUserMeetups(userId);
    res.json({ success: true, data: meetups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Failed to fetch meetups' });
  }
};

export const getMeetupDetailsController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const meetup = await fetchMeetupDetails(id, req.user.id);
    res.status(200).json({ success: true, data: meetup });
  } catch (error) {
    next(error);
  }
};

export const getMeetupHistoryController = async (req, res, next) => {
  try {
    const history = await fetchMeetupHistory(req.user.id);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

export const editMeetupController = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedMeetup = await updateMeetup(id, req.user.id, req.body);
    res.status(200).json({ success: true, data: updatedMeetup });
  } catch (error) {
    next(error);
  }
};

export const cancelMeetupController = async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteMeetup(id, req.user.id);
    res.status(200).json({ success: true, message: 'Meetup successfully cancelled.' });
  } catch (error) {
    next(error);
  }
};