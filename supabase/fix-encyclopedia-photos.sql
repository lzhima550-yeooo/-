-- Delete deprecated category
DELETE FROM public.encyclopedia_entries
WHERE category_code IN ('beneficial', 'beneficialPredator')
   OR category_name IN ('天敌益虫', '天敌昆虫')
   OR name = '小麦条锈病';

-- Repair wrong/random images by category
UPDATE public.encyclopedia_entries
SET image_url = CASE
  WHEN type = 'insect' AND name = '桃蚜' THEN '/images/encyclopedia/local/bda672ac61322aebb80e43d262913eb6.jpg'
  WHEN type = 'insect' AND name = '棉蚜' THEN '/images/encyclopedia/local/13a61076116cfd3da7c4303b4d75d8b6.jpg'
  WHEN type = 'insect' AND name = '七星瓢虫' THEN '/images/914ec19753ff41c467235a1cc8413f5f.jpg'
  WHEN type = 'disease' AND name = '番茄晚疫病' THEN '/images/encyclopedia/doc/doc-disease-01.png'
  WHEN type = 'disease' AND name = '黄瓜白粉病' THEN '/images/encyclopedia/doc/doc-disease-02.png'
  WHEN type = 'disease' AND name = '柑橘溃疡病' THEN '/images/encyclopedia/doc/doc-disease-03.png'
  WHEN type = 'disease' AND name = '茄子绵疫病' THEN '/images/encyclopedia/doc/doc-disease-04.png'
  WHEN type = 'disease' AND name = '小麦锈病（条锈病）' THEN '/images/encyclopedia/doc/doc-disease-05.png'
  WHEN type = 'disease' AND name = '芹菜斑枯病（晚疫病）' THEN '/images/encyclopedia/doc/doc-disease-06.png'
  WHEN type = 'disease' AND name = '水稻纹枯病' THEN '/images/encyclopedia/doc-2026/doc-disease-21.jpg'
  WHEN type = 'disease' AND name = '马铃薯早疫病' THEN '/images/encyclopedia/doc-2026/doc-disease-22.jpg'
  WHEN type = 'disease' AND name = '辣椒炭疽病' THEN '/images/encyclopedia/doc-2026/doc-disease-23.jpg'
  WHEN type = 'disease' AND name = '黄瓜霜霉病' THEN '/images/encyclopedia/doc-2026/doc-disease-24.jpg'
  WHEN type = 'disease' AND name = '葡萄霜霉病' THEN '/images/encyclopedia/doc-2026/doc-disease-25.jpg'
  WHEN type = 'disease' AND name = '白菜软腐病' THEN '/images/encyclopedia/doc-2026/doc-disease-26.png'
  WHEN type = 'insect' AND category_code = 'sapSucker' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuALAIKVw6nsOiMF9k-sS0EkB-6tVCoQbc_PXrLMkbq97AZbk0Mp3ISfwGIlOAscsyW0-s8TTlTd88KHROVDGsZJfzyO62Y7_k0GiU-KeyocAzvQYY5bLoFBWsCJ0qXAr54K12-GZ7_uriFVKEDIJi86i5pfuU62pMT_Gzr2v0_nYOMujO6C-TeRabyh3fYTBjoKdSAGqxntmXcBDH00He4hBrvXgKEnMsRZZArDLgI8BAeZhYpLA9vdSpns3lXJCffWPXc7s38Hsqw'
  WHEN type = 'insect' AND category_code = 'hopper' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxiE9ptcc3SdmdNFIurhtqW6YoiRsSVAUSr8hq72QEQA8FZyhUGJ5MdEsQ6DORSWq6OsO_GCkNXANigpJIRU_y4uyKsH_c1gvnLrEagKx0tXt6YlQWpm3Ck63rWSM2sCQOUvxv_t7XuRYgcpH73e8YlHrXv87mmwyeFQHJz7WRcQw6GEpliOV0jtw_Erops1h_gGkMN14wOYbbt89RmFdQuUvnezmKbgB9n7SuD1iBW0HdBE9I2RUubZCRMC-Hji0Y4SpR8oJoaCw'
  WHEN type = 'insect' AND category_code = 'mite' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXjI2euYFMKJ81k8s6Dd2-7-ulsBxsu-Iv77m4y-OXt-x3XtBp6ss9RxpQsJjUwMHPnrBN32qDLPW7eb_IxWIhX1VAnjt9wViWega0Pwj7LM5xHZVdo0U7v2z1WUSuLYJ4nqepHNXEsz8UuDkzxKNw8rT6Ry6VGttXY-ouJuiWNm0ktx-elkWXeA0xgtKeAJXTWacZPyXpa7ejXfMZc_8kTcuAOshEhfNKc7UPVcDCfxXQNTr-wOGRXKJTaGYFXxyrsK0bxwh_aiU'
  WHEN type = 'insect' AND category_code = 'leafChewer' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFpe3KiXbJCnxKDzO3aGr7rhZYRgkzI6PYQA6PV2aWrY8Ng3sRqhdvRhzHfL88sU2YdPjTFEVQs8pymYUziRxNbM6SF_J3gc2a5Oab4Y7VYrZmz9_Fe7odFaGif2PA3fj18JMCuY8yvKOG5mQ7L3qDaJySQezKH8h4uZDExoWwvd7buRlIkJS3or16_EPMYwy-42sKZCRm4LDY1artg-deNqk4Q9jrJhbUQQEYauAtTsuhdeu1WcX8xtt1yhhRjODpxo-Wjgt-TFY'
  WHEN type = 'insect' AND category_code = 'fruitPest' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuDzQlliYVM_LpxDi2vmBmLfZCjnIbg1yGqhe4xtUD7zfbEHs_YiMW0U3RD2jGWqBiAa8J0VtJeRTM8NtCNNC2-jlOwoGSc-f7nkB3c2HLzw56OIOM5fFaGRBHwGkLyF-g4YCDgpS7YnrlpCT4tCnMbkamFsksMZ0Sc2gIheVJLQ6mItwNo1SrUQ-i1x8Xqps5Hu0B3oiHY0iHehCIO13Za_i5HLDrb4g3ler9VbyUqJdtdG-w23p1LCDuRURQBJIWrmcvkNCvOX-lk'
  WHEN type = 'insect' AND category_code = 'borer' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuAFpe3KiXbJCnxKDzO3aGr7rhZYRgkzI6PYQA6PV2aWrY8Ng3sRqhdvRhzHfL88sU2YdPjTFEVQs8pymYUziRxNbM6SF_J3gc2a5Oab4Y7VYrZmz9_Fe7odFaGif2PA3fj18JMCuY8yvKOG5mQ7L3qDaJySQezKH8h4uZDExoWwvd7buRlIkJS3or16_EPMYwy-42sKZCRm4LDY1artg-deNqk4Q9jrJhbUQQEYauAtTsuhdeu1WcX8xtt1yhhRjODpxo-Wjgt-TFY'
  WHEN type = 'insect' AND category_code = 'miner' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuAxiE9ptcc3SdmdNFIurhtqW6YoiRsSVAUSr8hq72QEQA8FZyhUGJ5MdEsQ6DORSWq6OsO_GCkNXANigpJIRU_y4uyKsH_c1gvnLrEagKx0tXt6YlQWpm3Ck63rWSM2sCQOUvxv_t7XuRYgcpH73e8YlHrXv87mmwyeFQHJz7WRcQw6GEpliOV0jtw_Erops1h_gGkMN14wOYbbt89RmFdQuUvnezmKbgB9n7SuD1iBW0HdBE9I2RUubZCRMC-Hji0Y4SpR8oJoaCw'
  WHEN type = 'insect' AND category_code = 'soilPest' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuBXjI2euYFMKJ81k8s6Dd2-7-ulsBxsu-Iv77m4y-OXt-x3XtBp6ss9RxpQsJjUwMHPnrBN32qDLPW7eb_IxWIhX1VAnjt9wViWega0Pwj7LM5xHZVdo0U7v2z1WUSuLYJ4nqepHNXEsz8UuDkzxKNw8rT6Ry6VGttXY-ouJuiWNm0ktx-elkWXeA0xgtKeAJXTWacZPyXpa7ejXfMZc_8kTcuAOshEhfNKc7UPVcDCfxXQNTr-wOGRXKJTaGYFXxyrsK0bxwh_aiU'
  WHEN type = 'insect' AND category_code = 'scale' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuBeWf2PMuEECcimbCZpUW2TXAwhuMdvXTuo29y7E92-j9BpW3zJbX0PyDc13FMTqj5ic47_GCpFcMkmyAPF7gxPux6oFfYijT8FQ7InX0Zi-pQoL9D0kr3vWsBfZ4szuF2fV_e_b6a2LUsbz6IGVe3XyPov1-loD-tKw6UI_og1FBzfXDJDjFhba3DvsVRy-uF6oukbYRRRvebAHnI2yPDziICGBJbHJpxHpIA-rwPS6nng7nq_Pc960KpvucdDUruVNRy3DwSsK3Q'
  WHEN type = 'disease' AND category_code = 'powdery' THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuBzkUS5hEWFRyj4tm63W_UvLJb0yTfLOSmnk0Y7dC9-GY9HSsp6ZHo9rSscdV0JGNwSF22EYIzfCU4t7BEAuT8Vgz_8paJFBjRpZ6oXhcW_26izw_9wfbxXAoxnbo-UJZutbAO_6Hui1WwkQI0NtwvwQ39wmMe3ujQbQF7c6RnX_cD4bAMCluto2GuPFNi3FENPVWoqNPp_X5y3bctCixHTF0MGdnXA1Rhow-uEe58yR9ju5PvjZCy9tAU2p0zG4ovVtAGVMiZ0KsI'
  WHEN type = 'disease' AND category_code IN ('downy', 'fungalLeafSpot', 'rust') THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5QtyXp3ML5SPX6NeIQJfMe3vVcS4TFfpGqCDzF2ERRU5cUPf7Su53xVXmjiaC_xrxtT59ED4ZKPzdujrYhEJmKS4w9zvjUBgmH3AZ1Qux9twPo06dyX2WpwsHAakziwnJ0-Ss9ZOmsZOrh5xi6h_CXnY8dd__PaqrVcqydRhdZWsAcUzB5J3T1_TnrZRtLtFyAYLIRAU3XDJZkFtWYJxIKT_e2IbFJE0YH_2AuV3-V9mrRNH6C4mHB5TnL_vRvg_BxVJvHhmEskQ'
  WHEN type = 'disease' AND category_code IN ('blight', 'wilt', 'viral', 'nematode') THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuCC_4mMOqfq5WfBZvuvxoCEv9ckOM0WqXKhdbXjeJrYn99vL9v4QYwxei_YVkVztFX6Uo67RFVRHUzVxTjOtRgj3e5n1KJUym2DSUJrWha1aCI1wZWLUeQn1EjCSq7hmH8gvnm1VEAG2qY5Ytqgo9oq17Plg10yDKahRS9GUGGbHB2ZKxVgIJ4SiI2O-sg7rl8m9iK2ejAco37x5XHPKO-J4t3rhNrjT_mjyF2kyGUsYfiEntIUza8F96x8yfnt5Suhd5VPh6lIArU'
  WHEN type = 'disease' AND category_code IN ('rot', 'bacterial', 'oomycete') THEN 'https://lh3.googleusercontent.com/aida-public/AB6AXuA8WtCDDxsfu838RPap3jP7rjY6GfAiHmYbtXAUpdNSWKqWufNZqvKev9xgBs-23Yie2TiMFyTIy3qhqouCa_4azyY7uFSas1q1pm4DnNlytEaXlVaZ9eszRNNypdSCReL4jXYIiCIa4ZiZysOnUT8z2vQ0dqV4WA_5qOHChpl_ebrFaeAXwppAO0px4BMfTXXzZZDXQTHQ3lTbK7Iehs5eawl6dga8-Kh_NSrptB3_AIwc6uBG4uh2J0CpF_1WjiIwfpQntj_CNhM'
  ELSE '/images/community-post-fallback.svg'
END,
updated_at = now()
WHERE type IN ('insect', 'disease');
